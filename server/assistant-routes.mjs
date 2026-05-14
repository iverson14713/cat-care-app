import { systemBase, careBundleUserPrompt, qaUserPrompt } from './prompts.mjs';
import { openAiChatCompletion } from './openai.mjs';
import {
  assertDailyQuota,
  assertMinuteRate,
  getDailyLimit,
  incrementDailyUsed,
  peekDailyUsed,
} from './guard.mjs';
import { appendUsageLog } from './usage-log.mjs';

export const MAX_CONTEXT_CHARS = 48_000;
export const MAX_QUESTION_CHARS = 8_000;
export const CARE_MAX_TOKENS = 1200;
export const QA_MAX_TOKENS = 600;

const MODEL = (process.env.OPENAI_MODEL || 'gpt-5.4-mini').trim();

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
function assistantRateAndQuota(clientId, catId, usageDate, feature) {
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

  const daily = assertDailyQuota(clientId, usageDate);
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

async function handleCareBundle(lang, recordContext) {
  const { content, usage } = await openAiChatCompletion({
    messages: [
      { role: 'system', content: systemBase(lang) },
      { role: 'user', content: careBundleUserPrompt(lang, recordContext) },
    ],
    temperature: 0.25,
    maxTokens: CARE_MAX_TOKENS,
    jsonMode: true,
  });

  const parsed = tryParseJsonObject(content);
  const keys = ['healthSummary', 'sevenDayAnalysis', 'vetReport'];
  const out = {};
  for (const k of keys) {
    const v = parsed[k];
    if (typeof v !== 'string' || !v.trim()) {
      throw new Error(`Missing or invalid field: ${k}`);
    }
    out[k] = v.trim();
  }
  return { bundle: out, usage };
}

async function handleQa(lang, recordContext, question) {
  const { content, usage } = await openAiChatCompletion({
    messages: [
      { role: 'system', content: systemBase(lang) },
      { role: 'user', content: qaUserPrompt(lang, recordContext, question) },
    ],
    temperature: 0.25,
    maxTokens: QA_MAX_TOKENS,
    jsonMode: false,
  });
  return { answer: content, usage };
}

/**
 * @param {URLSearchParams} searchParams
 * @returns {{ status: number, json: object }}
 */
export function assistHealthGET(searchParams) {
  const clientId = (searchParams.get('clientId') || '').trim();
  const usageDate = (searchParams.get('usageDate') || '').trim();
  const openaiReady = Boolean(process.env.OPENAI_API_KEY?.trim());
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
  const limit = getDailyLimit(clientId);
  const used = peekDailyUsed(clientId, usageDate);
  const proIds = (process.env.AI_PRO_CLIENT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const planEffective = proIds.includes(clientId) ? 'pro' : 'free';
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

  const rq = assistantRateAndQuota(clientId, catId, usageDate, 'care-bundle');
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
    return {
      status: 503,
      json: { error: 'Server is not configured with OPENAI_API_KEY', code: 'NO_API_KEY' },
    };
  }

  try {
    const { bundle, usage } = await handleCareBundle(lang, recordContext);
    incrementDailyUsed(clientId, usageDate);
    const estUsd = estUsdFromUsage(usage);
    logLine({
      userId: clientId,
      catId,
      feature: 'care-bundle',
      ok: true,
      statusCode: 200,
      promptTokens: usage?.prompt_tokens ?? null,
      completionTokens: usage?.completion_tokens ?? null,
      totalTokens: usage?.total_tokens ?? null,
      estUsd,
    });
    return { status: 200, json: bundle };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logLine({
      userId: clientId,
      catId,
      feature: 'care-bundle',
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
        code: 'OPENAI',
        detail: msg.slice(0, 300),
      },
    };
  }
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

  const rq = assistantRateAndQuota(clientId, catId, usageDate, 'qa');
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
    return {
      status: 503,
      json: { error: 'Server is not configured with OPENAI_API_KEY', code: 'NO_API_KEY' },
    };
  }

  try {
    const { answer, usage } = await handleQa(lang, recordContext, question);
    incrementDailyUsed(clientId, usageDate);
    const estUsd = estUsdFromUsage(usage);
    logLine({
      userId: clientId,
      catId,
      feature: 'qa',
      ok: true,
      statusCode: 200,
      promptTokens: usage?.prompt_tokens ?? null,
      completionTokens: usage?.completion_tokens ?? null,
      totalTokens: usage?.total_tokens ?? null,
      estUsd,
    });
    return { status: 200, json: { answer } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logLine({
      userId: clientId,
      catId,
      feature: 'qa',
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
        code: 'OPENAI',
        detail: msg.slice(0, 300),
      },
    };
  }
}
