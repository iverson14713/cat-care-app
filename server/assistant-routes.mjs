import {
  systemBase,
  careBundleUserPrompt,
  qaSystemPrompt,
  qaUserPrompt,
  vetReportUserPrompt,
  weeklyReportUserPrompt,
} from './prompts.mjs';
import { openAiChatCompletion } from './openai.mjs';
import {
  assertDailyQuota,
  assertMinuteRate,
  effectivePlanForResponse,
  getDailyLimit,
  incrementDailyUsed,
  peekDailyUsed,
} from './guard.mjs';
import { appendUsageLog } from './usage-log.mjs';

export const MAX_CONTEXT_CHARS = 48_000;
export const MAX_QUESTION_CHARS = 8_000;
export const CARE_MAX_TOKENS = 450;
export const QA_MAX_TOKENS = 1500;
export const VET_REPORT_MAX_TOKENS = 900;
export const WEEKLY_REPORT_MAX_TOKENS = 2000;

const MODEL = (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();

function missingOpenAiKeyResponse(routeLabel) {
  console.error(`[PetCare AI] ${routeLabel} — server missing OPENAI_API_KEY`);
  return {
    status: 503,
    json: { error: 'Server is not configured with OPENAI_API_KEY', code: 'NO_API_KEY' },
  };
}

/** After incrementDailyUsed — attach to JSON so clients are not dependent on GET /health query parsing. */
function dailyQuotaFields(clientId, usageDate, planHint) {
  const limit = getDailyLimit(clientId, planHint);
  const used = peekDailyUsed(clientId, usageDate);
  return {
    dailyLimit: limit,
    dailyUsed: used,
    dailyRemaining: Math.max(0, limit - used),
  };
}

/** @param {unknown} planField */
function planHintFromBody(planField) {
  return planField === 'pro' ? 'pro' : 'free';
}

function estUsdFromUsage(usage) {
  const inPer1m = Number(process.env.AI_EST_INPUT_PER_1M_USD);
  const outPer1m = Number(process.env.AI_EST_OUTPUT_PER_1M_USD);
  if (!usage || (!Number.isFinite(inPer1m) && !Number.isFinite(outPer1m))) return null;
  const pt = typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0;
  const ct = typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0;
  const i = Number.isFinite(inPer1m) ? inPer1m : 0;
  const o = Number.isFinite(outPer1m) ? outPer1m : 0;
  if (i === 0 && o === 0) return null;
  return (pt / 1_000_000) * i + (ct / 1_000_000) * o;
}

function tryParseJsonObject(raw) {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('Invalid JSON from model');
  }
}

/** @param {unknown} v */
function careBundleCoerceString(v) {
  if (typeof v === 'string') return v.trim();
  if (v == null) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v).trim();
  return '';
}

/**
 * @param {Record<string, unknown>} obj
 * @param {readonly string[]} keys
 */
function careBundleFirstStringField(obj, keys) {
  for (const k of keys) {
    const s = careBundleCoerceString(obj[k]);
    if (s) return s;
  }
  return '';
}

/**
 * Accept canonical keys plus common aliases; fill missing/empty with safe defaults.
 * @param {unknown} parsed
 * @param {'zh' | 'en'} lang
 */
function normalizeCareBundleFromParsed(parsed, lang, recordContext = '') {
  const zh = lang === 'zh';
  const hasSignals = recordContextHasStructuredEvents(recordContext);
  const defaults = hasSignals
    ? {
        quickSummary: zh
          ? '最近紀錄中有異常或體重變化，請依「結構化照護事件」留意精神、飲食與排泄。'
          : 'Recent logs show abnormal or weight cues — see structured events for appetite and elimination.',
        careReminders: zh
          ? '• 持續記錄異常備註與體重\n• 留意是否再吐或軟便\n• 症狀加重請諮詢獸醫'
          : '• Keep logging abnormal notes and weight\n• Watch for repeat vomiting or soft stool\n• Contact your vet if worsening',
      }
    : {
        quickSummary: zh ? '目前無法產生快速摘要。' : 'Could not produce a quick summary.',
        careReminders: zh ? '請持續記錄今日照護項目。' : 'Keep logging today’s care items.',
      };
  let obj =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? /** @type {Record<string, unknown>} */ (parsed)
      : {};
  if (Array.isArray(parsed) && parsed[0] && typeof parsed[0] === 'object' && !Array.isArray(parsed[0])) {
    obj = /** @type {Record<string, unknown>} */ (parsed[0]);
  }
  const q =
    careBundleFirstStringField(obj, ['quickSummary', 'summary', 'healthSummary', 'todaySummary']) ||
    defaults.quickSummary;
  const r =
    careBundleFirstStringField(obj, [
      'careReminders',
      'reminders',
      'alerts',
      'sevenDayAnalysis',
    ]) || defaults.careReminders;
  return { quickSummary: q, careReminders: r };
}

/**
 * Model output was not valid JSON — surface raw text in the main block so the feature still works.
 * @param {'zh' | 'en'} lang
 * @param {string} raw
 */
function careBundleFromUnparsedContent(lang, raw) {
  const zh = lang === 'zh';
  const defaults = normalizeCareBundleFromParsed({}, lang);
  const t = typeof raw === 'string' ? raw.trim() : '';
  const prefix = zh
    ? '【以下為助理回覆原文；系統未能解析為預期 JSON，僅供參考。】\n\n'
    : '[Raw assistant reply; could not parse as the expected JSON — for reference only.]\n\n';
  const body = t || (zh ? '（模型未回傳可讀文字。）' : '(No readable text from the model.)');
  return {
    quickSummary: prefix + body,
    careReminders: defaults.careReminders,
  };
}

/** Stable client id from browser localStorage (not a login). */
export function isClientId(s) {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  return t.length >= 8 && t.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(t);
}

export function isYmd(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
}

export function isCatId(s) {
  return typeof s === 'string' && s.trim().length >= 1 && s.trim().length <= 128;
}

function logLine(partial) {
  appendUsageLog({
    t: new Date().toISOString(),
    model: MODEL,
    ...partial,
  });
}

/** @returns {{ ok: true } | { ok: false, status: number, json: object }} */
function assistantRateAndQuota(clientId, catId, usageDate, feature, planHint) {
  const minute = assertMinuteRate(clientId);
  if (!minute.ok) {
    logLine({
      userId: clientId,
      catId,
      feature,
      ok: false,
      statusCode: 429,
      error: minute.message || 'RATE',
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      estUsd: null,
    });
    return {
      ok: false,
      status: 429,
      json: {
        error:
          'Too many AI requests in a short time. Please wait about a minute and try again.',
        code: 'RATE',
      },
    };
  }

  const daily = assertDailyQuota(clientId, usageDate, planHint);
  if (!daily.ok) {
    logLine({
      userId: clientId,
      catId,
      feature,
      ok: false,
      statusCode: 429,
      error: 'QUOTA',
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      estUsd: null,
    });
    return {
      ok: false,
      status: 429,
      json: {
        error: 'Daily AI limit reached for this device. Try again tomorrow or upgrade to Pro.',
        code: 'QUOTA',
        limit: daily.limit,
        used: daily.used,
        remaining: 0,
      },
    };
  }

  return { ok: true };
}

/**
 * Shared path: OpenAI call → on success only, increment daily pool + append usage log + attach quota fields.
 * @param {{
 *   clientId: string;
 *   catId: string;
 *   usageDate: string;
 *   planHint: 'free' | 'pro';
 *   feature: 'care-bundle' | 'qa' | 'weekly-report' | 'vet-report';
 *   run: () => Promise<Record<string, unknown> & { usage: unknown }>;
 * }} opts
 * @returns {Promise<{ status: number, json: object }>}
 */
async function runAssistantOpenAiCounted(opts) {
  const { clientId, catId, usageDate, planHint, feature, run } = opts;
  try {
    const out = await run();
    const usage = out.usage;
    const { usage: _u, ...jsonPayload } = out;
    incrementDailyUsed(clientId, usageDate);
    const estUsd = estUsdFromUsage(usage);
    logLine({
      userId: clientId,
      catId,
      feature,
      ok: true,
      statusCode: 200,
      promptTokens: usage?.prompt_tokens ?? null,
      completionTokens: usage?.completion_tokens ?? null,
      totalTokens: usage?.total_tokens ?? null,
      estUsd,
    });
    return {
      status: 200,
      json: { ...jsonPayload, ...dailyQuotaFields(clientId, usageDate, planHint) },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code =
      e && typeof e === 'object' && 'code' in e && typeof e.code === 'string'
        ? e.code
        : e?.code === 'NO_API_KEY'
          ? 'NO_API_KEY'
          : 'OPENAI';
    if (code === 'NO_API_KEY') {
      console.error('[PetCare AI] server missing OPENAI_API_KEY');
    } else {
      console.error('[PetCare AI] OpenAI call failed', { feature, code, message: msg.slice(0, 500) });
    }
    logLine({
      userId: clientId,
      catId,
      feature,
      ok: false,
      statusCode: 502,
      error: msg.slice(0, 500),
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      estUsd: null,
    });
    return {
      status: 502,
      json: {
        error: 'The AI service returned an error. Please try again later.',
        code,
        detail: msg.slice(0, 300),
      },
    };
  }
}

async function handleCareBundle(lang, recordContext) {
  console.log('[AI care-bundle] request payload (recordContext)', {
    chars: recordContext.length,
    hasStructuredEvents: recordContextHasStructuredEvents(recordContext),
    preview: recordContext.slice(0, 2500),
  });
  const { content, usage } = await openAiChatCompletion({
    messages: [
      { role: 'system', content: systemBase(lang) },
      { role: 'user', content: careBundleUserPrompt(lang, recordContext) },
    ],
    temperature: 0.25,
    maxTokens: CARE_MAX_TOKENS,
    jsonMode: true,
  });
  console.log('[AI care-bundle] raw response', { preview: content.slice(0, 2500) });

  let bundle;
  try {
    const parsed = tryParseJsonObject(content);
    bundle = normalizeCareBundleFromParsed(parsed, lang, recordContext);
  } catch {
    bundle = careBundleFromUnparsedContent(lang, content);
  }
  return { bundle, usage };
}

async function handleQa(lang, recordContext, question) {
  const { content, usage } = await openAiChatCompletion({
    messages: [
      { role: 'system', content: qaSystemPrompt(lang) },
      { role: 'user', content: qaUserPrompt(lang, recordContext, question) },
    ],
    temperature: 0.35,
    maxTokens: QA_MAX_TOKENS,
    jsonMode: false,
  });
  return { answer: content, usage };
}

function normalizeWeeklyReportFromParsed(parsed, lang) {
  const zh = lang === 'zh';
  const defaults = {
    weekSummary: zh ? '目前無法產生本週總結。' : 'Could not produce the weekly summary.',
    completionRate: zh ? '目前無法評估照護完成度。' : 'Could not assess logging completion.',
    trends: zh ? '目前無法整理趨勢。' : 'Could not summarize trends.',
    abnormalTimeline: zh ? '本週無異常紀錄或資料不足。' : 'No abnormal timeline or insufficient data.',
    weightChange: zh ? '本週無體重紀錄。' : 'No weight entries this week.',
    vsLastWeek: zh ? '上週資料不足，無法比較。' : 'Not enough prior-week data to compare.',
    nextWeekFocus: zh ? '請持續記錄餵食、喝水與排泄。' : 'Keep logging meals, water, and litter.',
  };
  const obj =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? /** @type {Record<string, unknown>} */ (parsed)
      : {};
  const pick = (keys, fallback) => {
    for (const k of keys) {
      const s = careBundleCoerceString(obj[k]);
      if (s) return s;
    }
    return fallback;
  };
  return {
    weekSummary: pick(['weekSummary', 'weeklySummary', 'summary'], defaults.weekSummary),
    completionRate: pick(['completionRate', 'completion', 'loggingCompletion'], defaults.completionRate),
    trends: pick(['trends', 'trend'], defaults.trends),
    abnormalTimeline: pick(['abnormalTimeline', 'abnormal', 'watchItems'], defaults.abnormalTimeline),
    weightChange: pick(['weightChange', 'weight'], defaults.weightChange),
    vsLastWeek: pick(['vsLastWeek', 'compareLastWeek', 'lastWeekCompare'], defaults.vsLastWeek),
    nextWeekFocus: pick(['nextWeekFocus', 'nextWeek'], defaults.nextWeekFocus),
  };
}

async function handleWeeklyReport(lang, recordContext) {
  const { content, usage } = await openAiChatCompletion({
    messages: [
      { role: 'system', content: systemBase(lang) },
      { role: 'user', content: weeklyReportUserPrompt(lang, recordContext) },
    ],
    temperature: 0.25,
    maxTokens: WEEKLY_REPORT_MAX_TOKENS,
    jsonMode: true,
  });
  let report;
  try {
    report = normalizeWeeklyReportFromParsed(tryParseJsonObject(content), lang);
  } catch {
    report = normalizeWeeklyReportFromParsed({}, lang);
    report.weekSummary = content.trim().slice(0, 1200) || report.weekSummary;
  }
  return { ...report, usage };
}

/**
 * @param {URLSearchParams} searchParams
 * @returns {{ status: number, json: object }}
 */
export function assistHealthGET(searchParams) {
  const clientId = (searchParams.get('clientId') || '').trim();
  const usageDate = (searchParams.get('usageDate') || '').trim();
  const planHint = planHintFromBody(searchParams.get('plan'));
  const openaiReady = Boolean(process.env.OPENAI_API_KEY?.trim());
  if (!openaiReady) {
    console.error('[PetCare AI] GET /api/assistant/health — server missing OPENAI_API_KEY');
  }
  if (!isClientId(clientId) || !isYmd(usageDate)) {
    return {
      status: 200,
      json: {
        ok: true,
        openaiReady,
        dailyLimit: 3,
        dailyUsed: 0,
        dailyRemaining: 3,
        planEffective: 'free',
      },
    };
  }
  const limit = getDailyLimit(clientId, planHint);
  const used = peekDailyUsed(clientId, usageDate);
  const planEffective = effectivePlanForResponse(clientId, planHint);
  return {
    status: 200,
    json: {
      ok: true,
      openaiReady,
      dailyLimit: limit,
      dailyUsed: used,
      dailyRemaining: Math.max(0, limit - used),
      planEffective,
    },
  };
}

/**
 * @param {unknown} body
 * @returns {Promise<{ status: number, json: object }>}
 */
export async function assistCareBundlePOST(body) {
  const b = body && typeof body === 'object' ? body : {};
  const clientId = typeof b.clientId === 'string' ? b.clientId.trim() : '';
  const catId = typeof b.catId === 'string' ? b.catId.trim() : '';
  const usageDate = typeof b.usageDate === 'string' ? b.usageDate.trim() : '';

  if (!isClientId(clientId)) {
    return { status: 400, json: { error: 'Invalid or missing clientId', code: 'BAD_REQUEST' } };
  }
  if (!isCatId(catId)) {
    return { status: 400, json: { error: 'Invalid or missing catId', code: 'BAD_REQUEST' } };
  }
  if (!isYmd(usageDate)) {
    return {
      status: 400,
      json: { error: 'Invalid or missing usageDate (YYYY-MM-DD)', code: 'BAD_REQUEST' },
    };
  }

  const planHint = planHintFromBody(b.plan);
  const rq = assistantRateAndQuota(clientId, catId, usageDate, 'care-bundle', planHint);
  if (!rq.ok) return { status: rq.status, json: rq.json };

  const lang = b.lang;
  const recordContext = b.recordContext;
  if (lang !== 'zh' && lang !== 'en') {
    return { status: 400, json: { error: 'Invalid lang', code: 'BAD_REQUEST' } };
  }
  if (typeof recordContext !== 'string' || !recordContext.trim()) {
    return { status: 400, json: { error: 'Missing recordContext', code: 'BAD_REQUEST' } };
  }
  if (recordContext.length > MAX_CONTEXT_CHARS) {
    return { status: 400, json: { error: 'recordContext too long', code: 'BAD_REQUEST' } };
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return missingOpenAiKeyResponse('POST /api/assistant/care-bundle');
  }

  return runAssistantOpenAiCounted({
    clientId,
    catId,
    usageDate,
    planHint,
    feature: 'care-bundle',
    run: async () => {
      const { bundle, usage } = await handleCareBundle(lang, recordContext);
      return { ...bundle, usage };
    },
  });
}

/**
 * @param {unknown} body
 * @returns {Promise<{ status: number, json: object }>}
 */
export async function assistQaPOST(body) {
  const b = body && typeof body === 'object' ? body : {};
  const clientId = typeof b.clientId === 'string' ? b.clientId.trim() : '';
  const catId = typeof b.catId === 'string' ? b.catId.trim() : '';
  const usageDate = typeof b.usageDate === 'string' ? b.usageDate.trim() : '';

  if (!isClientId(clientId)) {
    return { status: 400, json: { error: 'Invalid or missing clientId', code: 'BAD_REQUEST' } };
  }
  if (!isCatId(catId)) {
    return { status: 400, json: { error: 'Invalid or missing catId', code: 'BAD_REQUEST' } };
  }
  if (!isYmd(usageDate)) {
    return {
      status: 400,
      json: { error: 'Invalid or missing usageDate (YYYY-MM-DD)', code: 'BAD_REQUEST' },
    };
  }

  const planHint = planHintFromBody(b.plan);
  const rq = assistantRateAndQuota(clientId, catId, usageDate, 'qa', planHint);
  if (!rq.ok) return { status: rq.status, json: rq.json };

  const lang = b.lang;
  const recordContext = b.recordContext;
  const question = b.question;
  if (lang !== 'zh' && lang !== 'en') {
    return { status: 400, json: { error: 'Invalid lang', code: 'BAD_REQUEST' } };
  }
  if (typeof recordContext !== 'string' || !recordContext.trim()) {
    return { status: 400, json: { error: 'Missing recordContext', code: 'BAD_REQUEST' } };
  }
  if (recordContext.length > MAX_CONTEXT_CHARS) {
    return { status: 400, json: { error: 'recordContext too long', code: 'BAD_REQUEST' } };
  }
  if (typeof question !== 'string' || !question.trim()) {
    return { status: 400, json: { error: 'Missing question', code: 'BAD_REQUEST' } };
  }
  if (question.length > MAX_QUESTION_CHARS) {
    return { status: 400, json: { error: 'question too long', code: 'BAD_REQUEST' } };
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return missingOpenAiKeyResponse('POST /api/assistant/qa');
  }

  return runAssistantOpenAiCounted({
    clientId,
    catId,
    usageDate,
    planHint,
    feature: 'qa',
    run: async () => {
      const { answer, usage } = await handleQa(lang, recordContext, question);
      return { answer, usage };
    },
  });
}

/**
 * @param {unknown} body
 * @returns {Promise<{ status: number, json: object }>}
 */
export async function assistWeeklyReportPOST(body) {
  const b = body && typeof body === 'object' ? body : {};
  const clientId = typeof b.clientId === 'string' ? b.clientId.trim() : '';
  const catId = typeof b.catId === 'string' ? b.catId.trim() : '';
  const usageDate = typeof b.usageDate === 'string' ? b.usageDate.trim() : '';

  if (!isClientId(clientId)) {
    return { status: 400, json: { error: 'Invalid or missing clientId', code: 'BAD_REQUEST' } };
  }
  if (!isCatId(catId)) {
    return { status: 400, json: { error: 'Invalid or missing catId', code: 'BAD_REQUEST' } };
  }
  if (!isYmd(usageDate)) {
    return {
      status: 400,
      json: { error: 'Invalid or missing usageDate (YYYY-MM-DD)', code: 'BAD_REQUEST' },
    };
  }

  const planHint = planHintFromBody(b.plan);
  const rq = assistantRateAndQuota(clientId, catId, usageDate, 'weekly-report', planHint);
  if (!rq.ok) return { status: rq.status, json: rq.json };

  const lang = b.lang;
  const recordContext = b.recordContext;
  if (lang !== 'zh' && lang !== 'en') {
    return { status: 400, json: { error: 'Invalid lang', code: 'BAD_REQUEST' } };
  }
  if (typeof recordContext !== 'string' || !recordContext.trim()) {
    return { status: 400, json: { error: 'Missing recordContext', code: 'BAD_REQUEST' } };
  }
  if (recordContext.length > MAX_CONTEXT_CHARS) {
    return { status: 400, json: { error: 'recordContext too long', code: 'BAD_REQUEST' } };
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return missingOpenAiKeyResponse('POST /api/assistant/weekly-report');
  }

  return runAssistantOpenAiCounted({
    clientId,
    catId,
    usageDate,
    planHint,
    feature: 'weekly-report',
    run: async () => {
      const { usage, ...report } = await handleWeeklyReport(lang, recordContext);
      return { ...report, usage };
    },
  });
}

function recordContextHasStructuredEvents(recordContext) {
  const m = String(recordContext).match(/結構化照護事件（共 (\d+) 則/);
  if (m && Number(m[1]) > 0) return true;
  const m2 = String(recordContext).match(/Structured care events \((\d+) total\)/i);
  if (m2 && Number(m2[1]) > 0) return true;
  return false;
}

function isWeakVetReportField(text, lang) {
  const t = String(text || '').trim();
  if (!t || t === '—' || t === '-') return true;
  const weakZh = ['無法整理', '目前無法', '資料不足', '減少至', '增加至'];
  const weakEn = ['could not summarize', 'unable to summarize', 'insufficient data'];
  const patterns = lang === 'zh' ? weakZh : weakEn;
  if (patterns.some((p) => t.includes(p))) return true;
  if (/^\d{4}-\d{2}-\d{2}：/.test(t) && t.length < 48) return true;
  if (/^\d{1,2}\/\d{1,2}：/.test(t) && t.length < 48) return true;
  return false;
}

function recordContextHasCareConcerns(recordContext) {
  const ctx = String(recordContext);
  if (recordContextHasStructuredEvents(ctx)) return true;
  return /嘔吐|呕吐|vomit|拉肚子|軟便|腹瀉|食慾|appetite|精神|letharg/i.test(ctx);
}

function vetReportFallbackSummary(lang, recordContext) {
  const zh = lang === 'zh';
  const ctx = String(recordContext);
  const vomiting = /嘔吐|呕吐|vomit/i.test(ctx);
  const diarrhea = /拉肚子|軟便|腹瀉|稀便|diarr|loose stool|soft stool/i.test(ctx);
  const appetite = /食慾|不吃|吃得少|appetite|not eating/i.test(ctx);
  const parts = [];
  if (vomiting) parts.push(zh ? '嘔吐' : 'vomiting');
  if (diarrhea) parts.push(zh ? '軟便／腹瀉' : 'soft stool/diarrhea');
  if (appetite) parts.push(zh ? '食慾變化' : 'appetite changes');

  const watchItems =
    parts.length >= 2
      ? zh
        ? `近期紀錄出現${parts.slice(0, 2).join('與')}等狀況，建議持續觀察排便型態、食慾與活動力；若症狀持續超過 1～2 天，建議諮詢獸醫。`
        : `Recent logs mention ${parts.slice(0, 2).join(' and ')}. Keep watching stool, appetite, and energy; contact your vet if symptoms last more than 1–2 days.`
      : parts.length === 1
        ? zh
          ? `近期紀錄出現${parts[0]}相關描述，建議持續觀察精神、飲食與排泄；若加重請諮詢獸醫。`
          : `Recent logs suggest ${parts[0]}. Monitor energy, eating, and elimination; see your vet if worsening.`
        : zh
          ? '此期間照護紀錄未見明顯異常關鍵字，建議維持日常記錄習慣。'
          : 'No clear abnormal keywords in this period — keep logging daily.';

  return {
    watchItems,
    observeDirections: zh
      ? '可持續記錄每日進食量與排便情況。若再次出現嘔吐、腹瀉或精神不佳，建議進一步就醫評估。'
      : 'Keep logging daily food intake and stool. Seek care for repeat vomiting, diarrhea, or low energy.',
    vetHandoff: zh
      ? '請依「異常／備註時間線」與體重趨勢解讀向獸醫說明最近照護紀錄。'
      : 'Use the abnormal timeline and weight interpretation when speaking with your vet.',
  };
}

function normalizeVetReportFromParsed(parsed, lang, recordContext = '') {
  const hasSignals = recordContextHasCareConcerns(recordContext);
  const fallback = vetReportFallbackSummary(lang, recordContext);
  const defaults = hasSignals
    ? fallback
    : {
        watchItems: lang === 'zh' ? '此期間照護紀錄平穩，建議維持日常記錄。' : 'Records look routine — keep logging daily.',
        observeDirections:
          lang === 'zh'
            ? '可持續記錄進食、喝水與排便，方便日後比較。'
            : 'Keep logging food, water, and stool for future comparison.',
        vetHandoff:
          lang === 'zh'
            ? '此期間無明顯異常摘要，可依需要補充飲食與生活習慣。'
            : 'No major abnormal summary in this period; add diet and routine notes as needed.',
      };
  const obj =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? /** @type {Record<string, unknown>} */ (parsed)
      : {};
  const rawWatch =
    typeof obj.watchItems === 'string' && obj.watchItems.trim() ? obj.watchItems.trim() : '';
  const rawObserve =
    typeof obj.observeDirections === 'string' && obj.observeDirections.trim()
      ? obj.observeDirections.trim()
      : '';
  const rawVet = typeof obj.vetHandoff === 'string' && obj.vetHandoff.trim() ? obj.vetHandoff.trim() : '';

  const watchItems =
    rawWatch && !(hasSignals && isWeakVetReportField(rawWatch, lang))
      ? rawWatch
      : isWeakVetReportField(rawWatch, lang)
        ? defaults.watchItems
        : rawWatch || defaults.watchItems;
  const observeDirections =
    rawObserve && !isWeakVetReportField(rawObserve, lang) ? rawObserve : defaults.observeDirections;
  const vetHandoff = rawVet && !isWeakVetReportField(rawVet, lang) ? rawVet : defaults.vetHandoff;
  return { watchItems, observeDirections, vetHandoff };
}

async function handleVetReport(lang, recordContext) {
  console.log('[AI vet-report] request payload (recordContext)', {
    chars: recordContext.length,
    hasStructuredEvents: recordContextHasStructuredEvents(recordContext),
    preview: recordContext.slice(0, 2500),
  });
  const { content, usage } = await openAiChatCompletion({
    messages: [
      { role: 'system', content: systemBase(lang) },
      { role: 'user', content: vetReportUserPrompt(lang, recordContext) },
    ],
    temperature: 0.25,
    maxTokens: VET_REPORT_MAX_TOKENS,
    jsonMode: true,
  });
  console.log('[AI vet-report] raw response', { preview: content.slice(0, 2500) });
  let summary;
  try {
    summary = normalizeVetReportFromParsed(tryParseJsonObject(content), lang, recordContext);
  } catch {
    summary = normalizeVetReportFromParsed({}, lang, recordContext);
    summary.watchItems = content.trim().slice(0, 1200) || summary.watchItems;
  }
  return { ...summary, usage };
}

/**
 * Vet report AI — shares the same daily AI pool as care-bundle / qa / weekly-report.
 * @param {unknown} body
 * @returns {Promise<{ status: number, json: object }>}
 */
export async function assistVetReportPOST(body) {
  const b = body && typeof body === 'object' ? body : {};
  const clientId = typeof b.clientId === 'string' ? b.clientId.trim() : '';
  const catId = typeof b.catId === 'string' ? b.catId.trim() : '';
  const usageDate = typeof b.usageDate === 'string' ? b.usageDate.trim() : '';

  if (!isClientId(clientId)) {
    return { status: 400, json: { error: 'Invalid or missing clientId', code: 'BAD_REQUEST' } };
  }
  if (!isCatId(catId)) {
    return { status: 400, json: { error: 'Invalid or missing catId', code: 'BAD_REQUEST' } };
  }
  if (!isYmd(usageDate)) {
    return {
      status: 400,
      json: { error: 'Invalid or missing usageDate (YYYY-MM-DD)', code: 'BAD_REQUEST' },
    };
  }

  const lang = b.lang;
  const recordContext = b.recordContext;
  if (lang !== 'zh' && lang !== 'en') {
    return { status: 400, json: { error: 'Invalid lang', code: 'BAD_REQUEST' } };
  }
  if (typeof recordContext !== 'string' || !recordContext.trim()) {
    return { status: 400, json: { error: 'Missing recordContext', code: 'BAD_REQUEST' } };
  }
  if (recordContext.length > MAX_CONTEXT_CHARS) {
    return { status: 400, json: { error: 'recordContext too long', code: 'BAD_REQUEST' } };
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return missingOpenAiKeyResponse('POST /api/assistant/vet-report');
  }

  const planHint = planHintFromBody(b.plan);
  const rq = assistantRateAndQuota(clientId, catId, usageDate, 'vet-report', planHint);
  if (!rq.ok) return { status: rq.status, json: rq.json };

  return runAssistantOpenAiCounted({
    clientId,
    catId,
    usageDate,
    planHint,
    feature: 'vet-report',
    run: async () => handleVetReport(lang, recordContext),
  });
}
