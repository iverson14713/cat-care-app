import { Capacitor } from '@capacitor/core';
import type {
  AssistantContext,
  AssistantCareBundleJson,
  AssistantWeeklyReportJson,
  DailyData,
  Lang,
} from './aiCareAssistant';
import { assistantApiUrl, getAssistantApiBase } from './lib/assistantApiBase';
import { getDailyItemsForPetType, getMonthlyItemsForPetType, type PetType } from './petTypes';
import {
  applySuccessfulAiUsage,
  buildLocalAiQuota,
  careBundleCacheKey,
  djb2Hash,
  readCareBundleCacheJson,
  syncLocalAiUsageFromServer,
  writeCareBundleCacheJson,
} from './aiClient';
import { normalizeWeeklyReport } from './weeklyReportModel';
import {
  buildStructuredCareEventLines,
  buildWeightNarrativeLines,
  formatDayCareChecklistLine,
} from './aiRecordNarrative';

const DAILY_CHECKBOX_IDS = [
  'feedMorning',
  'feedNight',
  'litterMorning',
  'litterNight',
  'walkMorning',
  'walkNight',
  'pee',
  'poop',
  'waterCan',
  'snack',
  'brushHair',
  'brushTeeth',
] as const;

const DAILY_LABELS: Record<Lang, Record<string, string>> = {
  zh: {
    feedMorning: '早上餵食',
    feedNight: '晚上餵食',
    litterMorning: '早上清貓砂',
    litterNight: '晚上清貓砂',
    walkMorning: '早上散步',
    walkNight: '晚上散步',
    pee: '今日排尿',
    poop: '今日排便',
    waterCan: '飲水／罐頭',
    snack: '點心',
    brushHair: '梳毛',
    brushTeeth: '刷牙',
  },
  en: {
    feedMorning: 'Morning feeding',
    feedNight: 'Evening feeding',
    litterMorning: 'Morning litter',
    litterNight: 'Evening litter',
    walkMorning: 'Morning walk',
    walkNight: 'Evening walk',
    pee: 'Pee today',
    poop: 'Poop today',
    waterCan: 'Water / wet food',
    snack: 'Snack',
    brushHair: 'Brushing',
    brushTeeth: 'Teeth brushing',
  },
};

const MONTHLY_LABELS: Record<Lang, Record<string, string>> = {
  zh: {
    changeLitter: '換貓砂',
    changeLitterDog: '環境清潔',
    deworming: '驅蟲',
    vaccine: '疫苗',
    vetVisit: '看診',
    bath: '洗澡',
    nailTrim: '剪指甲',
    catFood: '貓糧／貓砂補貨',
    dogFoodStock: '狗糧／尿墊補貨',
  },
  en: {
    changeLitter: 'Litter change',
    changeLitterDog: 'Environment cleaning',
    deworming: 'Deworming',
    vaccine: 'Vaccine',
    vetVisit: 'Vet visit',
    bath: 'Bath',
    nailTrim: 'Nail trim',
    catFood: 'Food / litter stock',
    dogFoodStock: 'Food / pee pads stock',
  },
};

function formatPetAgeForLlm(birthday: string | undefined, lang: Lang): string {
  if (!birthday?.trim()) return lang === 'zh' ? '未填寫' : 'Not set';
  const birthDate = new Date(birthday);
  if (Number.isNaN(birthDate.getTime())) return lang === 'zh' ? '未填寫' : 'Not set';
  const now = new Date();
  let years = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  const dayDiff = now.getDate() - birthDate.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) years -= 1;
  const months = Math.max(
    0,
    (now.getFullYear() - birthDate.getFullYear()) * 12 +
      now.getMonth() -
      birthDate.getMonth() -
      (dayDiff < 0 ? 1 : 0)
  );
  if (years <= 0) {
    return lang === 'zh' ? `約 ${months} 個月` : `about ${months} months`;
  }
  return lang === 'zh' ? `約 ${years} 歲` : `about ${years} years`;
}

function dailyIdsForPet(petType: PetType): string[] {
  return getDailyItemsForPetType(petType).map((i) => i.id);
}

function monthlyIdsForPet(petType: PetType): { id: string; labelKey: string }[] {
  return getMonthlyItemsForPetType(petType).map((i) => ({ id: i.id, labelKey: i.labelKey }));
}

const API_PREFIX = '/api/assistant';

const CARE_BUNDLE_DEFAULTS: Record<'zh' | 'en', AssistantCareBundleJson> = {
  zh: {
    quickSummary: '目前無法產生快速摘要。',
    careReminders: '請持續記錄今日照護項目。',
  },
  en: {
    quickSummary: 'Could not produce a quick summary.',
    careReminders: 'Keep logging today’s care items.',
  },
};

function careBundleCoerceString(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (v == null) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v).trim();
  return '';
}

function careBundleFirstField(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const s = careBundleCoerceString(obj[k]);
    if (s) return s;
  }
  return '';
}

/** Same rules as server: canonical + alias keys, safe defaults for missing/empty fields. */
export function normalizeCareBundlePayload(data: Record<string, unknown>, lang: 'zh' | 'en'): AssistantCareBundleJson {
  const d = CARE_BUNDLE_DEFAULTS[lang];
  let obj: Record<string, unknown> =
    data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  if (Array.isArray(data) && data[0] && typeof data[0] === 'object' && !Array.isArray(data[0])) {
    obj = data[0] as Record<string, unknown>;
  }
  const q = careBundleFirstField(obj, [
    'quickSummary',
    'summary',
    'healthSummary',
    'todaySummary',
  ]);
  const r = careBundleFirstField(obj, [
    'careReminders',
    'reminders',
    'alerts',
    'sevenDayAnalysis',
  ]);
  return {
    quickSummary: q || d.quickSummary,
    careReminders: r || d.careReminders,
  };
}

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function boolLine(data: DailyData, id: string): string {
  return `${id}: ${data[id] === true ? 'yes' : 'no'}`;
}

function strField(data: DailyData, key: string): string {
  const v = data[key];
  return typeof v === 'string' ? v.trim() : '';
}

function photoCount(data: DailyData, key: 'dailyPhotos' | 'abnormalPhotos'): number {
  const v = data[key];
  if (!Array.isArray(v)) return 0;
  return v.filter((x) => typeof x === 'string' && x.length > 0).length;
}

export class AssistantApiError extends Error {
  readonly code?: string;

  readonly httpStatus?: number;

  constructor(message: string, code?: string, httpStatus?: number) {
    super(message);
    this.name = 'AssistantApiError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** User-facing copy for GET /health failures (network / non-JSON / HTTP error). */
export type AssistantHealthFetchFailure = {
  reason: 'network' | 'http' | 'parse';
  status?: number;
  detail?: string;
};

export type AssistantHealthFetchResult =
  | { ok: true; payload: AssistantHealthPayload }
  | { ok: false; failure: AssistantHealthFetchFailure };

export function getAssistantHealthFailureUserHint(lang: Lang, failure: AssistantHealthFetchFailure): string {
  const zh = lang === 'zh';
  if (failure.reason === 'parse') {
    return zh ? 'AI 服務資料格式異常，請稍後再試。' : 'Unexpected response from the AI service. Please try again later.';
  }
  if (failure.reason === 'http') {
    const s = failure.status != null ? String(failure.status) : '?';
    return zh
      ? `無法取得 AI 服務狀態（${s}），請稍後再試。`
      : `Could not load AI service status (${s}). Please try again later.`;
  }
  return zh ? '無法連線到 AI 服務，請確認網路後再試。' : 'Cannot connect to the AI service. Check your network and try again.';
}

/** Map server JSON `code` / HTTP status to short UI strings (no stack traces). */
export function mapAssistantApiErrorToUserMessage(lang: Lang, err: unknown): string {
  const zh = lang === 'zh';
  if (err instanceof AssistantApiError) {
    const c = err.code;
    const st = err.httpStatus;
    if (c === 'QUOTA' || (st === 429 && c === 'QUOTA')) {
      return zh ? '今日 AI 次數已用完。' : 'Daily AI limit reached for today.';
    }
    if (c === 'RATE' || c === 'OPENAI_RATE') {
      return zh ? '操作過於頻繁，請稍待後再試。' : 'Too many requests — please wait a moment.';
    }
    if (c === 'NO_API_KEY') {
      return zh ? '目前服務暫時無法使用，請稍後再試。' : 'This service is temporarily unavailable. Please try again later.';
    }
    if (c === 'BAD_REQUEST') {
      return zh
        ? '目前紀錄較少或內容無法處理，請先新增更多照護紀錄後再試。'
        : 'Not enough data or invalid request — add more care logs and try again.';
    }
    if (c === 'OPENAI_AUTH') {
      return zh ? 'AI 服務認證異常，請稍後再試。' : 'AI authentication issue — please try again later.';
    }
    if (c === 'OPENAI') {
      return zh ? 'AI 服務忙碌中，請稍後再試。' : 'The AI service is busy. Please try again later.';
    }
  }
  return zh ? 'AI 服務忙碌中，請稍後再試。' : 'The AI service is busy. Please try again later.';
}

export type AssistantRequestMeta = {
  clientId: string;
  catId: string;
  usageDate: string;
  plan: 'free' | 'pro';
};

export type AssistantHealthPayload = {
  openaiReady: boolean;
  dailyLimit: number;
  dailyUsed: number;
  dailyRemaining: number;
  planEffective: 'free' | 'pro';
};

export type AssistantQuotaSnapshot = Pick<
  AssistantHealthPayload,
  'dailyLimit' | 'dailyUsed' | 'dailyRemaining'
>;

/** True when the client already knows today’s pool is empty (server is still authoritative). */
export function isAssistantDailyQuotaExhausted(
  quota: Pick<AssistantHealthPayload, 'dailyRemaining'> | null
): boolean {
  return quota != null && quota.dailyRemaining <= 0;
}

/**
 * Block a new care-bundle API call (not a local cache read).
 * Cached bundle can still be shown without spending a slot.
 */
export function isAssistantCareBundleNetworkBlocked(
  quota: Pick<AssistantHealthPayload, 'dailyRemaining'> | null,
  hasCachedBundle: boolean
): boolean {
  if (hasCachedBundle) return false;
  return isAssistantDailyQuotaExhausted(quota);
}

/** Merge server snapshot with localStorage; limit always follows client `plan` (Pro test = 30). */
export function mergeAssistantQuotaFromSnapshot(
  prev: AssistantHealthPayload | null,
  quota: AssistantQuotaSnapshot,
  plan: 'free' | 'pro',
  clientId: string,
  usageDate: string,
  options?: { countedSuccess?: boolean }
): AssistantHealthPayload {
  const merged = options?.countedSuccess
    ? applySuccessfulAiUsage(plan, clientId, usageDate, quota.dailyUsed)
    : buildLocalAiQuota(plan, clientId, usageDate, quota.dailyUsed);
  return {
    openaiReady: prev?.openaiReady ?? true,
    planEffective: plan,
    dailyLimit: merged.dailyLimit,
    dailyUsed: merged.dailyUsed,
    dailyRemaining: merged.dailyRemaining,
  };
}

function quotaAfterCountedAiSuccess(
  data: Record<string, unknown>,
  meta: AssistantRequestMeta
): AssistantQuotaSnapshot {
  const raw = parseQuotaSnapshot(data);
  return applySuccessfulAiUsage(
    meta.plan,
    meta.clientId,
    meta.usageDate,
    raw?.dailyUsed
  );
}

export function buildAssistantHealthFromLocal(
  plan: 'free' | 'pro',
  clientId: string,
  usageDate: string,
  partial?: Partial<Pick<AssistantHealthPayload, 'openaiReady'>>
): AssistantHealthPayload {
  const q = buildLocalAiQuota(plan, clientId, usageDate);
  return {
    openaiReady: partial?.openaiReady ?? false,
    planEffective: plan,
    dailyLimit: q.dailyLimit,
    dailyUsed: q.dailyUsed,
    dailyRemaining: q.dailyRemaining,
  };
}

function reconcileAssistantHealth(
  plan: 'free' | 'pro',
  clientId: string,
  usageDate: string,
  server: AssistantHealthPayload
): AssistantHealthPayload {
  const merged = buildLocalAiQuota(plan, clientId, usageDate, server.dailyUsed);
  return {
    openaiReady: server.openaiReady,
    planEffective: plan,
    dailyLimit: merged.dailyLimit,
    dailyUsed: merged.dailyUsed,
    dailyRemaining: merged.dailyRemaining,
  };
}

function parseQuotaSnapshot(d: Record<string, unknown>): AssistantQuotaSnapshot | null {
  const dailyLimit = Number(d.dailyLimit);
  const dailyUsed = Number(d.dailyUsed);
  const dailyRemaining = Number(d.dailyRemaining);
  if (!Number.isFinite(dailyLimit) || !Number.isFinite(dailyUsed) || !Number.isFinite(dailyRemaining)) {
    return null;
  }
  return { dailyLimit, dailyUsed, dailyRemaining };
}

async function readAssistantApiError(res: Response, route: string): Promise<{ message: string; code?: string }> {
  const t = await res.text();
  try {
    const j = JSON.parse(t) as { error?: string; code?: string; detail?: string };
    const errStr = typeof j?.error === 'string' ? j.error.trim() : '';
    const detStr = typeof j?.detail === 'string' ? j.detail.trim() : '';
    const code = typeof j?.code === 'string' ? j.code : undefined;
    console.warn('[PetCare AI] API error', {
      route,
      status: res.status,
      code,
      error: errStr,
      detail: detStr.slice(0, 300),
    });
    let msg: string;
    if (detStr && errStr && detStr !== errStr) {
      msg = `${errStr}（${detStr}）`;
    } else if (detStr) {
      msg = detStr;
    } else {
      msg = errStr || t.trim() || res.statusText;
    }
    if (!msg) msg = `HTTP ${res.status}`;
    return { message: msg, code };
  } catch {
    console.warn('[PetCare AI] API non-JSON error body', {
      route,
      status: res.status,
      preview: t.slice(0, 300),
    });
    const fallback = t.trim() || res.statusText;
    return { message: fallback || `HTTP ${res.status}` };
  }
}

/** Compact facts for the model — no image bytes. Uses recentDaysForAi (max 14d) + weights in that window only. */
export function buildRecordContextForLlm(ctx: AssistantContext): string {
  const recent = ctx.recentDaysForAi.length ? ctx.recentDaysForAi : ctx.last7Days;
  const oldest = recent.length > 0 ? recent[recent.length - 1].date : ctx.today;
  const petType = ctx.petType ?? ctx.cat.petType ?? 'cat';
  const dailyIds = dailyIdsForPet(petType);
  const monthlyItems = monthlyIdsForPet(petType);
  const lang = ctx.lang;
  const labels = DAILY_LABELS[lang];

  const wRows = ctx.weightRecords
    .filter((w) => w.date >= oldest && w.date <= ctx.today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 16);

  const latestWeight = ctx.weightRecords
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  const lines: string[] = [];
  const zh = lang === 'zh';
  lines.push(zh ? '--- 寵物基本資料（請優先參考） ---' : '--- Pet profile (prioritize) ---');
  lines.push(`${zh ? '名稱' : 'Name'}: ${ctx.cat.name}`);
  lines.push(`${zh ? '類型' : 'Species'}: ${petType === 'dog' ? (zh ? '狗' : 'Dog') : zh ? '貓' : 'Cat'}`);
  lines.push(`${zh ? '年齡' : 'Age'}: ${formatPetAgeForLlm(ctx.cat.birthday, lang)}`);
  lines.push(`${zh ? '品種' : 'Breed'}: ${clip(ctx.cat.breed ?? '', 120) || (zh ? '未填寫' : 'Not set')}`);
  lines.push(`${zh ? '性別' : 'Gender'}: ${clip(ctx.cat.gender ?? '', 40) || (zh ? '未填寫' : 'Not set')}`);
  lines.push(`${zh ? '是否結紮' : 'Neutered/spayed'}: ${clip(ctx.cat.neutered ?? '', 40) || (zh ? '未填寫' : 'Not set')}`);
  if (latestWeight) {
    lines.push(
      `${zh ? '最近體重' : 'Latest weight'}: ${latestWeight.weight} kg (${latestWeight.date})${latestWeight.note ? ` | ${clip(latestWeight.note, 120)}` : ''}`
    );
  } else {
    lines.push(`${zh ? '最近體重' : 'Latest weight'}: ${zh ? '無紀錄' : 'No records'}`);
  }
  lines.push(`${zh ? '慢性病／用藥' : 'Chronic / meds'}: ${clip(ctx.cat.chronicNote ?? '', 400) || (zh ? '無' : 'None noted')}`);
  lines.push(`${zh ? '過敏' : 'Allergies'}: ${clip(ctx.cat.allergyNote ?? '', 300) || (zh ? '無' : 'None noted')}`);
  lines.push(`${zh ? '常用獸醫院' : 'Vet clinic'}: ${clip(ctx.cat.vetClinic ?? '', 200) || (zh ? '未填寫' : 'Not set')}`);
  lines.push(`${zh ? '其他備註' : 'Profile note'}: ${clip(ctx.cat.profileNote ?? '', 400) || (zh ? '無' : 'None')}`);
  lines.push('');
  lines.push(`Language for reply: ${zh ? 'Traditional Chinese (zh-TW)' : 'English'}`);
  lines.push(`Today (local date): ${ctx.today}`);
  lines.push(`Month key (YYYY-MM): ${ctx.monthKey}`);
  lines.push(`Number of pets in app: ${ctx.catsCount}`);
  lines.push('');
  lines.push(zh ? '--- 今日照護紀錄 ---' : '--- Today daily record ---');
  const d = ctx.todayDaily;
  for (const id of dailyIds) {
    const label = labels[id] ?? id;
    lines.push(`${label}: ${d[id] === true ? (zh ? '是' : 'yes') : zh ? '否' : 'no'}`);
  }
  lines.push(`${zh ? '異常備註' : 'abnormalNote'}: ${clip(strField(d, 'abnormalNote'), 600) || (zh ? '（無）' : '(none)')}`);
  lines.push(`${zh ? '今日備註' : 'dailyNote'}: ${clip(strField(d, 'dailyNote'), 600) || (zh ? '（無）' : '(none)')}`);
  lines.push(`${zh ? '異常照片數' : 'abnormalPhotosCount'}: ${photoCount(d, 'abnormalPhotos')}`);
  lines.push(`${zh ? '今日照片數' : 'dailyPhotosCount'}: ${photoCount(d, 'dailyPhotos')}`);
  lines.push('');
  const structuredEvents = buildStructuredCareEventLines(recent, lang, petType);
  if (structuredEvents.length > 0) {
    lines.push('');
    lines.push(
      zh
        ? `--- 結構化照護事件（共 ${structuredEvents.length} 則） ---`
        : `--- Structured care events (${structuredEvents.length}) ---`
    );
    for (const e of structuredEvents) lines.push(e);
  }
  lines.push('');
  lines.push(
    zh
      ? `--- 最近 ${recent.length} 天紀錄（最多 14 天；新→舊） ---`
      : `--- Last ${recent.length} days (max 14; newest first) ---`
  );
  for (const day of recent) {
    lines.push(formatDayCareChecklistLine(day.date, day.data, lang, petType));
  }
  lines.push('');
  const weightNarrative = buildWeightNarrativeLines(wRows, lang);
  lines.push(
    zh
      ? `--- 同期體重紀錄（新→舊，最多 ${weightNarrative.length} 筆） ---`
      : `--- Weight in same window (newest first, max ${weightNarrative.length}) ---`
  );
  if (!weightNarrative.length) {
    lines.push(zh ? '（無）' : '(none)');
  } else {
    for (const w of weightNarrative) lines.push(w);
  }
  lines.push('');
  lines.push(zh ? '--- 本月定期照顧（勾選） ---' : '--- Monthly checklist (current month) ---');
  const mLabels = MONTHLY_LABELS[lang];
  for (const { id, labelKey } of monthlyItems) {
    const label = mLabels[labelKey] ?? id;
    lines.push(`${label}: ${ctx.monthlyCare[id] === true ? (zh ? '已完成' : 'done') : zh ? '未完成' : 'not done'}`);
  }
  return lines.join('\n');
}

function appendDayRecordsBlock(
  lines: string[],
  days: { date: string; data: DailyData }[],
  label: string
): void {
  lines.push(label);
  if (!days.length) {
    lines.push('(no days in range)');
    lines.push('');
    return;
  }
  for (const day of days) {
    const x = day.data;
    const bits = DAILY_CHECKBOX_IDS.map((id) => `${id}=${x[id] === true ? 1 : 0}`).join(', ');
    const an = strField(x, 'abnormalNote');
    const dn = strField(x, 'dailyNote');
    lines.push(
      `${day.date}: ${bits} | abnormalNote="${clip(an, 200)}" | dailyNote="${clip(dn, 200)}" | abnormalPhotos=${photoCount(x, 'abnormalPhotos')} | dailyPhotos=${photoCount(x, 'dailyPhotos')}`
    );
  }
  lines.push('');
}

/** Today + up to 14 recent days — quick AI snapshot only. */
export function buildQuickAnalysisContextForLlm(ctx: AssistantContext): string {
  const recent = ctx.recentDaysForAi.length
    ? ctx.recentDaysForAi.slice(0, 14)
    : ctx.last7Days.length
      ? ctx.last7Days
      : [];
  const oldest = recent.length > 0 ? recent[recent.length - 1].date : ctx.today;
  const petType = ctx.petType ?? ctx.cat.petType ?? 'cat';
  const wRows = ctx.weightRecords
    .filter((w) => w.date >= oldest && w.date <= ctx.today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);

  const lines: string[] = [];
  const zh = ctx.lang === 'zh';
  lines.push(
    zh
      ? '--- 任務：快速照護摘要（今日＋最近 7～14 天；非完整週報） ---'
      : '--- Task: quick care snapshot (today + last 7–14 days — NOT a full weekly report) ---'
  );
  lines.push(`Language for reply: ${zh ? 'Traditional Chinese (zh-TW)' : 'English'}`);
  lines.push(`Today (local date): ${ctx.today}`);
  lines.push(`Selected cat name: ${ctx.cat.name}`);
  lines.push(`Chronic / meds note: ${clip(ctx.cat.chronicNote ?? '', 300)}`);
  lines.push('');

  const todayEvents = buildStructuredCareEventLines([{ date: ctx.today, data: ctx.todayDaily }], ctx.lang, petType);
  const recentEvents = buildStructuredCareEventLines(recent, ctx.lang, petType);
  const allEvents = [...todayEvents, ...recentEvents.filter((e) => !todayEvents.includes(e))];
  if (allEvents.length > 0) {
    lines.push(
      zh
        ? `--- 結構化照護事件（共 ${allEvents.length} 則） ---`
        : `--- Structured care events (${allEvents.length}) ---`
    );
    for (const e of allEvents) lines.push(e);
    lines.push('');
  }

  lines.push(zh ? '--- 今日照護勾選 ---' : '--- Today daily record ---');
  lines.push(formatDayCareChecklistLine(ctx.today, ctx.todayDaily, ctx.lang, petType));
  lines.push('');
  lines.push(
    zh
      ? `--- 最近 ${recent.length} 天（新→舊） ---`
      : `--- Recent ${recent.length} days (newest first) ---`
  );
  for (const day of recent) {
    lines.push(formatDayCareChecklistLine(day.date, day.data, ctx.lang, petType));
  }
  lines.push('');
  const weightNarrative = buildWeightNarrativeLines(wRows, ctx.lang);
  lines.push(zh ? '--- 近期體重 ---' : '--- Recent weight ---');
  if (!weightNarrative.length) lines.push(zh ? '（無）' : '(none)');
  else for (const w of weightNarrative) lines.push(w);

  const text = lines.join('\n');
  console.log('[AI care-bundle] request payload (recordContext)', {
    chars: text.length,
    structuredEventCount: allEvents.length,
    recentDays: recent.length,
    preview: text.slice(0, 2000),
  });
  return text;
}

function normalizeWeeklyReportPayload(data: Record<string, unknown>, lang: 'zh' | 'en'): AssistantWeeklyReportJson {
  return normalizeWeeklyReport(data, lang);
}

/** This week + previous week (up to 14 days) — formal Pro weekly report. */
export function buildWeeklyReportContextForLlm(ctx: AssistantContext): string {
  const all = ctx.recentDaysForAi.length >= 7 ? ctx.recentDaysForAi : [...ctx.last7Days, ...ctx.recentDaysForAi];
  const deduped: { date: string; data: DailyData }[] = [];
  const seen = new Set<string>();
  for (const day of all) {
    if (seen.has(day.date)) continue;
    seen.add(day.date);
    deduped.push(day);
    if (deduped.length >= 14) break;
  }
  const thisWeek = deduped.slice(0, 7);
  const prevWeek = deduped.slice(7, 14);
  const oldest = deduped.length ? deduped[deduped.length - 1].date : ctx.today;
  const wRows = ctx.weightRecords
    .filter((w) => w.date >= oldest && w.date <= ctx.today)
    .slice(0, 20);

  const lines: string[] = [];
  const zh = ctx.lang === 'zh';
  lines.push(
    zh
      ? '--- 任務：正式照護週報（本週 vs 上週；完整格式） ---'
      : '--- Task: formal weekly care report (this week vs previous week) ---'
  );
  lines.push(`Language for reply: ${zh ? 'Traditional Chinese (zh-TW)' : 'English'}`);
  lines.push(`Today (local date): ${ctx.today}`);
  lines.push(`Selected cat: ${ctx.cat.name}`);
  lines.push(`Chronic / meds: ${clip(ctx.cat.chronicNote ?? '', 400)}`);
  lines.push(`Allergy: ${clip(ctx.cat.allergyNote ?? '', 300)}`);
  lines.push('');
  const petType = ctx.petType ?? ctx.cat.petType ?? 'cat';
  const weekEvents = buildStructuredCareEventLines(deduped, ctx.lang, petType);
  if (weekEvents.length > 0) {
    lines.push(
      zh
        ? `--- 結構化照護事件（共 ${weekEvents.length} 則） ---`
        : `--- Structured care events (${weekEvents.length}) ---`
    );
    for (const e of weekEvents) lines.push(e);
    lines.push('');
  }
  lines.push(zh ? '--- 本週（最近 7 天，新→舊）---' : '--- This week (last 7 days, newest first) ---');
  for (const day of thisWeek) {
    lines.push(formatDayCareChecklistLine(day.date, day.data, ctx.lang, petType));
  }
  lines.push('');
  lines.push(zh ? '--- 上週（再往前 7 天，新→舊）---' : '--- Previous week (days 8–14 back, newest first) ---');
  for (const day of prevWeek) {
    lines.push(formatDayCareChecklistLine(day.date, day.data, ctx.lang, petType));
  }
  lines.push('');
  const weightNarrative = buildWeightNarrativeLines(wRows, ctx.lang);
  lines.push(zh ? '--- 體重紀錄（同期間，新→舊）---' : '--- Weight entries (same window, newest first) ---');
  if (!weightNarrative.length) lines.push('(none)');
  else for (const w of weightNarrative) lines.push(w);
  return lines.join('\n');
}

let loggedNativeAssistantBaseHint = false;

/** Server reachable + quota snapshot. */
export async function fetchAssistantHealth(
  clientId: string,
  usageDate: string,
  signal?: AbortSignal,
  plan: 'free' | 'pro' = 'free'
): Promise<AssistantHealthFetchResult> {
  const qs = new URLSearchParams({ clientId, usageDate, plan });
  const url = assistantApiUrl(`${API_PREFIX}/health?${qs}`);
  try {
    const res = await fetch(url, { signal });
    const text = await res.text();
    if (!res.ok) {
      console.warn('[PetCare AI] GET /api/assistant/health HTTP error', {
        url,
        status: res.status,
        bodyPreview: text.slice(0, 400),
      });
      return {
        ok: false,
        failure: { reason: 'http', status: res.status, detail: text.slice(0, 200) },
      };
    }
    let d: Record<string, unknown>;
    try {
      d = JSON.parse(text) as Record<string, unknown>;
    } catch (e) {
      console.warn('[PetCare AI] GET /api/assistant/health invalid JSON', {
        url,
        preview: text.slice(0, 300),
        error: e instanceof Error ? e.message : String(e),
      });
      return { ok: false, failure: { reason: 'parse', detail: 'invalid json' } };
    }
    const serverUsed = typeof d?.dailyUsed === 'number' ? d.dailyUsed : Number(d?.dailyUsed) || 0;
    syncLocalAiUsageFromServer(clientId, usageDate, serverUsed);
    const raw: AssistantHealthPayload = {
      openaiReady: Boolean(d?.openaiReady),
      dailyLimit: typeof d?.dailyLimit === 'number' ? d.dailyLimit : Number(d?.dailyLimit) || 0,
      dailyUsed: serverUsed,
      dailyRemaining:
        typeof d?.dailyRemaining === 'number' ? d.dailyRemaining : Number(d?.dailyRemaining) || 0,
      planEffective: d?.planEffective === 'pro' ? 'pro' : 'free',
    };
    return { ok: true, payload: reconcileAssistantHealth(plan, clientId, usageDate, raw) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[PetCare AI] GET /api/assistant/health failed', { url, message: msg });
    if (
      !loggedNativeAssistantBaseHint &&
      Capacitor.isNativePlatform() &&
      !getAssistantApiBase().trim()
    ) {
      loggedNativeAssistantBaseHint = true;
      console.warn(
        '[PetCare AI] Capacitor: set VITE_ASSISTANT_API_BASE_URL at build time to the HTTPS root of your deployment that serves /api/assistant/* (e.g. https://your-app.vercel.app). See .env.example.'
      );
    }
    return { ok: false, failure: { reason: 'network', detail: msg } };
  }
}

/** Hash of the payload sent to the care-bundle API (for stale UI + cache keys). */
export function getCareBundleContextHash(ctx: AssistantContext): string {
  return djb2Hash(buildQuickAnalysisContextForLlm(ctx));
}

/** Read cached care bundle for current cat/day/context without calling the network. */
export function peekCareBundleCache(
  ctx: AssistantContext,
  meta: AssistantRequestMeta
): AssistantCareBundleJson | null {
  const recordContext = buildQuickAnalysisContextForLlm(ctx);
  const h = djb2Hash(recordContext);
  const ck = careBundleCacheKey(meta.catId, meta.usageDate, h);
  const cachedRaw = readCareBundleCacheJson(ck);
  if (!cachedRaw) return null;
  try {
    const parsed = JSON.parse(cachedRaw) as Record<string, unknown>;
    return normalizeCareBundlePayload(parsed, ctx.lang);
  } catch (err) {
    console.error('[AI care bundle] corrupt session cache', err);
    return null;
  }
}

export async function generateAssistantCareBundleOpenAi(
  ctx: AssistantContext,
  meta: AssistantRequestMeta,
  signal?: AbortSignal
): Promise<{ bundle: AssistantCareBundleJson; quota: AssistantQuotaSnapshot | null }> {
  const recordContext = buildQuickAnalysisContextForLlm(ctx);
  const ck = careBundleCacheKey(meta.catId, meta.usageDate, djb2Hash(recordContext));
  const fromCache = peekCareBundleCache(ctx, meta);
  if (fromCache) return { bundle: fromCache, quota: null };

  const requestBody = {
    lang: ctx.lang,
    recordContext,
    clientId: meta.clientId,
    catId: meta.catId,
    usageDate: meta.usageDate,
    plan: meta.plan,
  };

  const res = await fetch(assistantApiUrl(`${API_PREFIX}/care-bundle`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    signal,
  });
  const rawText = await res.text();
  console.log('[AI care-bundle] raw response', {
    status: res.status,
    preview: rawText.slice(0, 2500),
  });
  if (!res.ok) {
    let errData: Record<string, unknown> = {};
    try {
      errData = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
    const message =
      typeof errData.error === 'string' ? errData.error : rawText.trim() || res.statusText;
    const code = typeof errData.code === 'string' ? errData.code : undefined;
    throw new AssistantApiError(message, code, res.status);
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawText) as Record<string, unknown>;
  } catch (parseErr) {
    console.error('[AI care bundle] invalid JSON response', parseErr);
    throw new AssistantApiError('Invalid JSON response', 'OPENAI', res.status);
  }
  const bundle = normalizeCareBundlePayload(data, ctx.lang);
  writeCareBundleCacheJson(ck, JSON.stringify(bundle));
  const quota = quotaAfterCountedAiSuccess(data, meta);
  return { bundle, quota };
}

export async function generateAssistantQaOpenAi(
  ctx: AssistantContext,
  question: string,
  meta: AssistantRequestMeta,
  signal?: AbortSignal
): Promise<{ answer: string; quota: AssistantQuotaSnapshot | null }> {
  const recordContext = buildRecordContextForLlm(ctx);
  const res = await fetch(assistantApiUrl(`${API_PREFIX}/qa`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lang: ctx.lang,
      recordContext,
      question: question.trim(),
      clientId: meta.clientId,
      catId: meta.catId,
      usageDate: meta.usageDate,
      plan: meta.plan,
    }),
    signal,
  });
  if (!res.ok) {
    const { message, code } = await readAssistantApiError(res, 'POST /api/assistant/qa');
    throw new AssistantApiError(message, code, res.status);
  }
  const data = (await res.json()) as Record<string, unknown>;
  if (typeof data.answer !== 'string') {
    throw new Error('Invalid response: missing answer');
  }
  const quota = quotaAfterCountedAiSuccess(data, meta);
  return { answer: data.answer.trim(), quota };
}

export async function generateAssistantWeeklyReportOpenAi(
  ctx: AssistantContext,
  meta: AssistantRequestMeta,
  signal?: AbortSignal
): Promise<{ report: AssistantWeeklyReportJson; quota: AssistantQuotaSnapshot | null }> {
  const recordContext = buildWeeklyReportContextForLlm(ctx);
  const res = await fetch(assistantApiUrl(`${API_PREFIX}/weekly-report`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lang: ctx.lang,
      recordContext,
      clientId: meta.clientId,
      catId: meta.catId,
      usageDate: meta.usageDate,
      plan: meta.plan,
    }),
    signal,
  });
  if (!res.ok) {
    const { message, code } = await readAssistantApiError(res, 'POST /api/assistant/weekly-report');
    throw new AssistantApiError(message, code, res.status);
  }
  let data: Record<string, unknown>;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch (parseErr) {
    console.error('[AI weekly report] invalid JSON response', parseErr);
    throw new AssistantApiError('Invalid JSON response', 'OPENAI', res.status);
  }
  const quota = quotaAfterCountedAiSuccess(data, meta);
  const report = normalizeWeeklyReportPayload(data, ctx.lang);
  if (!report.weekSummary && !report.trends) {
    console.error('[AI weekly report] unexpected payload shape', data);
  }
  return { report, quota };
}
