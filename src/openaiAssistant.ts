import type { AssistantContext, AssistantCareBundleJson, DailyData } from './aiCareAssistant';
import {
  buildLocalAiQuota,
  careBundleCacheKey,
  djb2Hash,
  readCareBundleCacheJson,
  syncLocalAiUsageFromServer,
  writeCareBundleCacheJson,
} from './aiClient';

const DAILY_CHECKBOX_IDS = [
  'feedMorning',
  'feedNight',
  'litterMorning',
  'litterNight',
  'pee',
  'poop',
  'waterCan',
  'snack',
  'brushHair',
  'brushTeeth',
] as const;

const MONTHLY_IDS = [
  'changeLitter',
  'deworming',
  'vaccine',
  'vetVisit',
  'bath',
  'nailTrim',
  'catFood',
] as const;

const API_PREFIX = '/api/assistant';

const CARE_BUNDLE_DEFAULTS: Record<'zh' | 'en', AssistantCareBundleJson> = {
  zh: {
    healthSummary: '目前無法產生今日摘要。',
    sevenDayAnalysis: '目前無法產生週期分析。',
    vetReport: '目前沒有需整理給獸醫的重點。',
  },
  en: {
    healthSummary: "Could not produce today's summary.",
    sevenDayAnalysis: 'Could not produce the weekly analysis.',
    vetReport: 'No vet handoff highlights from logs at this time.',
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
function normalizeCareBundlePayload(data: Record<string, unknown>, lang: 'zh' | 'en'): AssistantCareBundleJson {
  const d = CARE_BUNDLE_DEFAULTS[lang];
  let obj: Record<string, unknown> =
    data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  if (Array.isArray(data) && data[0] && typeof data[0] === 'object' && !Array.isArray(data[0])) {
    obj = data[0] as Record<string, unknown>;
  }
  const h = careBundleFirstField(obj, [
    'healthSummary',
    'summary',
    'todaySummary',
    'health_summary',
  ]);
  const s = careBundleFirstField(obj, [
    'sevenDayAnalysis',
    'alerts',
    'weeklyAnalysis',
    'weekAnalysis',
    'seven_day_analysis',
  ]);
  const v = careBundleFirstField(obj, ['vetReport', 'vet_summary', 'vetHandoff']);
  return {
    healthSummary: h || d.healthSummary,
    sevenDayAnalysis: s || d.sevenDayAnalysis,
    vetReport: v || d.vetReport,
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
  usageDate: string
): AssistantHealthPayload {
  const merged = buildLocalAiQuota(plan, clientId, usageDate, quota.dailyUsed);
  return {
    openaiReady: prev?.openaiReady ?? true,
    planEffective: plan,
    dailyLimit: merged.dailyLimit,
    dailyUsed: merged.dailyUsed,
    dailyRemaining: merged.dailyRemaining,
  };
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

async function readAssistantApiError(res: Response): Promise<{ message: string; code?: string }> {
  const t = await res.text();
  try {
    const j = JSON.parse(t) as { error?: string; code?: string; detail?: string };
    const errStr = typeof j?.error === 'string' ? j.error.trim() : '';
    const detStr = typeof j?.detail === 'string' ? j.detail.trim() : '';
    const code = typeof j?.code === 'string' ? j.code : undefined;
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
    const fallback = t.trim() || res.statusText;
    return { message: fallback || `HTTP ${res.status}` };
  }
}

/** Compact facts for the model — no image bytes. Uses recentDaysForAi (max 14d) + weights in that window only. */
export function buildRecordContextForLlm(ctx: AssistantContext): string {
  const recent = ctx.recentDaysForAi.length ? ctx.recentDaysForAi : ctx.last7Days;
  const oldest =
    recent.length > 0 ? recent[recent.length - 1].date : ctx.today;
  const wRows = ctx.weightRecords
    .filter((w) => w.date >= oldest && w.date <= ctx.today)
    .slice(0, 16);

  const lines: string[] = [];
  lines.push(`Language for reply: ${ctx.lang === 'zh' ? 'Traditional Chinese (zh-TW)' : 'English'}`);
  lines.push(`Today (local date): ${ctx.today}`);
  lines.push(`Month key (YYYY-MM): ${ctx.monthKey}`);
  lines.push(`Number of cats in app: ${ctx.catsCount}`);
  lines.push(`Selected cat name: ${ctx.cat.name}`);
  lines.push(`Cat emoji: ${ctx.cat.emoji}`);
  lines.push(`Chronic / meds note: ${clip(ctx.cat.chronicNote ?? '', 400)}`);
  lines.push(`Allergy note: ${clip(ctx.cat.allergyNote ?? '', 300)}`);
  lines.push(`Preferred vet clinic: ${clip(ctx.cat.vetClinic ?? '', 200)}`);
  lines.push(`Profile note: ${clip(ctx.cat.profileNote ?? '', 400)}`);
  lines.push('');
  lines.push('--- Today daily record ---');
  const d = ctx.todayDaily;
  for (const id of DAILY_CHECKBOX_IDS) {
    lines.push(boolLine(d, id));
  }
  lines.push(`abnormalNote: ${clip(strField(d, 'abnormalNote'), 600)}`);
  lines.push(`dailyNote: ${clip(strField(d, 'dailyNote'), 600)}`);
  lines.push(`abnormalPhotosCount: ${photoCount(d, 'abnormalPhotos')}`);
  lines.push(`dailyPhotosCount: ${photoCount(d, 'dailyPhotos')}`);
  lines.push('');
  lines.push(`--- Last ${recent.length} days for trend (max 14; newest first) ---`);
  for (const day of recent) {
    const x = day.data;
    const bits = DAILY_CHECKBOX_IDS.map((id) => `${id}=${x[id] === true ? 1 : 0}`).join(', ');
    const an = strField(x, 'abnormalNote');
    const dn = strField(x, 'dailyNote');
    lines.push(
      `${day.date}: ${bits} | abnormalNote="${clip(an, 200)}" | dailyNote="${clip(dn, 200)}" | abnormalPhotos=${photoCount(x, 'abnormalPhotos')} | dailyPhotos=${photoCount(x, 'dailyPhotos')}`
    );
  }
  lines.push('');
  lines.push(`--- Weight records in same window (newest first, max ${wRows.length}) ---`);
  for (const w of wRows) {
    lines.push(`${w.date}: ${w.weight} kg | note: ${clip(w.note, 200)}`);
  }
  lines.push('');
  lines.push('--- Monthly checklist (current month) ---');
  for (const id of MONTHLY_IDS) {
    lines.push(`${id}: ${ctx.monthlyCare[id] === true ? 'yes' : 'no'}`);
  }
  return lines.join('\n');
}

/** Server reachable + quota snapshot. Returns null on network / parse failure. */
export async function fetchAssistantHealth(
  clientId: string,
  usageDate: string,
  signal?: AbortSignal,
  plan: 'free' | 'pro' = 'free'
): Promise<AssistantHealthPayload | null> {
  try {
    const qs = new URLSearchParams({ clientId, usageDate, plan });
    const res = await fetch(`${API_PREFIX}/health?${qs}`, { signal });
    if (!res.ok) return null;
    const d = (await res.json()) as Record<string, unknown>;
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
    return reconcileAssistantHealth(plan, clientId, usageDate, raw);
  } catch {
    return null;
  }
}

/** Hash of the payload sent to the care-bundle API (for stale UI + cache keys). */
export function getCareBundleContextHash(ctx: AssistantContext): string {
  return djb2Hash(buildRecordContextForLlm(ctx));
}

/** Read cached care bundle for current cat/day/context without calling the network. */
export function peekCareBundleCache(
  ctx: AssistantContext,
  meta: AssistantRequestMeta
): AssistantCareBundleJson | null {
  const recordContext = buildRecordContextForLlm(ctx);
  const h = djb2Hash(recordContext);
  const ck = careBundleCacheKey(meta.catId, meta.usageDate, h);
  const cachedRaw = readCareBundleCacheJson(ck);
  if (!cachedRaw) return null;
  try {
    const parsed = JSON.parse(cachedRaw) as Record<string, unknown>;
    return normalizeCareBundlePayload(parsed, ctx.lang);
  } catch {
    return null;
  }
}

export async function generateAssistantCareBundleOpenAi(
  ctx: AssistantContext,
  meta: AssistantRequestMeta,
  signal?: AbortSignal
): Promise<{ bundle: AssistantCareBundleJson; quota: AssistantQuotaSnapshot | null }> {
  const recordContext = buildRecordContextForLlm(ctx);
  const ck = careBundleCacheKey(meta.catId, meta.usageDate, djb2Hash(recordContext));
  const fromCache = peekCareBundleCache(ctx, meta);
  if (fromCache) return { bundle: fromCache, quota: null };

  const res = await fetch(`${API_PREFIX}/care-bundle`, {
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
    const { message, code } = await readAssistantApiError(res);
    throw new AssistantApiError(message, code, res.status);
  }
  const data = (await res.json()) as Record<string, unknown>;
  const quotaRaw = parseQuotaSnapshot(data);
  const quota = quotaRaw
    ? buildLocalAiQuota(meta.plan, meta.clientId, meta.usageDate, quotaRaw.dailyUsed)
    : null;
  const bundle = normalizeCareBundlePayload(data, ctx.lang);
  writeCareBundleCacheJson(ck, JSON.stringify(bundle));
  return { bundle, quota };
}

export async function generateAssistantQaOpenAi(
  ctx: AssistantContext,
  question: string,
  meta: AssistantRequestMeta,
  signal?: AbortSignal
): Promise<{ answer: string; quota: AssistantQuotaSnapshot | null }> {
  const recordContext = buildRecordContextForLlm(ctx);
  const res = await fetch(`${API_PREFIX}/qa`, {
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
    const { message, code } = await readAssistantApiError(res);
    throw new AssistantApiError(message, code, res.status);
  }
  const data = (await res.json()) as Record<string, unknown>;
  if (typeof data.answer !== 'string') {
    throw new Error('Invalid response: missing answer');
  }
  const quotaRaw = parseQuotaSnapshot(data);
  const quota = quotaRaw
    ? buildLocalAiQuota(meta.plan, meta.clientId, meta.usageDate, quotaRaw.dailyUsed)
    : null;
  return { answer: data.answer.trim(), quota };
}
