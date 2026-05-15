const CLIENT_KEY = 'cat-ai-client-id';
const PLAN_KEY = 'cat-ai-plan';
const CARE_PREFIX = 'cat-ai-care:v2:';

/** Daily AI pool size (care-bundle + Q&A share one counter). */
export const AI_USAGE_LIMIT_FREE = 3;
export const AI_USAGE_LIMIT_PRO = 30;

export function getDailyAiLimit(plan: 'free' | 'pro'): number {
  return plan === 'pro' ? AI_USAGE_LIMIT_PRO : AI_USAGE_LIMIT_FREE;
}

/** localStorage key: ai-usage-YYYY-MM-DD (per device client id). */
export function aiUsageStorageKey(clientId: string, usageDate: string): string {
  return `ai-usage-${usageDate}`;
}

function readAiUsageStore(clientId: string, usageDate: string): number {
  try {
    const raw = localStorage.getItem(aiUsageStorageKey(clientId, usageDate));
    if (!raw) return 0;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  } catch {
    return 0;
  }
}

/** Persist today's used count for this device (survives tab change / refresh). */
export function writeLocalAiUsageCount(clientId: string, usageDate: string, used: number): void {
  try {
    const n = Math.max(0, Math.floor(used));
    localStorage.setItem(aiUsageStorageKey(clientId, usageDate), String(n));
  } catch {
    // private mode / quota
  }
}

export function readLocalAiUsageCount(clientId: string, usageDate: string): number {
  return readAiUsageStore(clientId, usageDate);
}

/** After a successful AI API response — keep local count in sync (never decrease). */
export function syncLocalAiUsageFromServer(
  clientId: string,
  usageDate: string,
  serverUsed: number
): number {
  const used = Math.max(readLocalAiUsageCount(clientId, usageDate), Math.max(0, Math.floor(serverUsed)));
  writeLocalAiUsageCount(clientId, usageDate, used);
  return used;
}

export type LocalAiQuotaFields = {
  dailyLimit: number;
  dailyUsed: number;
  dailyRemaining: number;
};

/** Build quota numbers for UI from plan + persisted local used (optionally merge server used). */
export function buildLocalAiQuota(
  plan: 'free' | 'pro',
  clientId: string,
  usageDate: string,
  serverUsed?: number
): LocalAiQuotaFields {
  const limit = getDailyAiLimit(plan);
  const used =
    serverUsed != null && Number.isFinite(serverUsed)
      ? syncLocalAiUsageFromServer(clientId, usageDate, serverUsed)
      : readLocalAiUsageCount(clientId, usageDate);
  const dailyRemaining = Math.max(0, limit - used);
  return { dailyLimit: limit, dailyUsed: used, dailyRemaining };
}

/** Remaining uses for display / gating (same pool as server). */
export function remainingAiUsage(
  plan: 'free' | 'pro',
  clientId: string,
  usageDate: string,
  serverUsed?: number
): number {
  return buildLocalAiQuota(plan, clientId, usageDate, serverUsed).dailyRemaining;
}

/**
 * After a successful counted AI call (care-bundle / qa / weekly-report).
 * Serverless hosts may return a low `dailyUsed` (cold instance); always bump local by at least 1.
 */
export function applySuccessfulAiUsage(
  plan: 'free' | 'pro',
  clientId: string,
  usageDate: string,
  serverUsed?: number
): LocalAiQuotaFields {
  const limit = getDailyAiLimit(plan);
  const local = readLocalAiUsageCount(clientId, usageDate);
  const server =
    serverUsed != null && Number.isFinite(serverUsed) ? Math.max(0, Math.floor(serverUsed)) : null;
  let nextUsed = local + 1;
  if (server != null && server > nextUsed) nextUsed = server;
  nextUsed = Math.min(nextUsed, limit);
  writeLocalAiUsageCount(clientId, usageDate, nextUsed);
  return {
    dailyLimit: limit,
    dailyUsed: nextUsed,
    dailyRemaining: Math.max(0, limit - nextUsed),
  };
}

export function getOrCreateClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id || id.trim().length < 8) {
      id = crypto.randomUUID();
      localStorage.setItem(CLIENT_KEY, id);
    }
    return id.trim();
  } catch {
    return `fallback-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

/** Stored in localStorage; drives client UI and is sent as `plan` to the assistant API. */
export function getAiPlan(): 'free' | 'pro' {
  try {
    return localStorage.getItem(PLAN_KEY) === 'pro' ? 'pro' : 'free';
  } catch {
    return 'free';
  }
}

export function setAiPlan(plan: 'free' | 'pro'): void {
  try {
    if (plan === 'pro') localStorage.setItem(PLAN_KEY, 'pro');
    else localStorage.removeItem(PLAN_KEY);
  } catch {
    // ignore
  }
}

export function djb2Hash(str: string): string {
  let h = 5381 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

export function careBundleCacheKey(catId: string, usageDate: string, contextHash: string): string {
  return `${CARE_PREFIX}${catId}:${usageDate}:${contextHash}`;
}

export function readCareBundleCacheJson(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeCareBundleCacheJson(key: string, json: string): void {
  try {
    sessionStorage.setItem(key, json);
  } catch {
    // quota / private mode
  }
}
