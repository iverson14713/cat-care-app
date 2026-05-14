const FREE_DEFAULT = 3;
const PRO_DEFAULT = 30;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 3;

function freeLimit() {
  const n = Number(process.env.AI_FREE_DAILY_LIMIT);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : FREE_DEFAULT;
}

function proLimit() {
  const n = Number(process.env.AI_PRO_DAILY_LIMIT);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : PRO_DEFAULT;
}

function proClientSet() {
  const raw = process.env.AI_PRO_CLIENT_IDS || '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/** Pro quota only if client UUID is listed in AI_PRO_CLIENT_IDS (server-side). */
export function getDailyLimit(clientId) {
  if (typeof clientId !== 'string' || !clientId.trim()) return freeLimit();
  return proClientSet().has(clientId.trim()) ? proLimit() : freeLimit();
}

const dailyUsage = new Map();
const minuteHits = new Map();

function dailyKey(clientId, usageDate) {
  return `${clientId}|${usageDate}`;
}

export function peekDailyUsed(clientId, usageDate) {
  return dailyUsage.get(dailyKey(clientId, usageDate)) || 0;
}

export function incrementDailyUsed(clientId, usageDate) {
  const k = dailyKey(clientId, usageDate);
  dailyUsage.set(k, (dailyUsage.get(k) || 0) + 1);
}

/** @returns {{ ok: true, used: number, limit: number, remaining: number } | { ok: false, code: 'QUOTA', used: number, limit: number, remaining: number }} */
export function assertDailyQuota(clientId, usageDate) {
  const limit = getDailyLimit(clientId);
  const used = peekDailyUsed(clientId, usageDate);
  const remaining = Math.max(0, limit - used);
  if (used >= limit) {
    return { ok: false, code: 'QUOTA', used, limit, remaining: 0 };
  }
  return { ok: true, used, limit, remaining };
}

/** Sliding 1-minute window, max RATE_MAX requests per clientId. */
export function assertMinuteRate(clientId) {
  const now = Date.now();
  const id = typeof clientId === 'string' ? clientId.trim() : '';
  if (!id) return { ok: false, code: 'RATE', message: 'Missing clientId' };

  let arr = minuteHits.get(id) || [];
  arr = arr.filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    minuteHits.set(id, arr);
    return { ok: false, code: 'RATE', message: 'Too many requests; try again in about a minute.' };
  }
  arr.push(now);
  minuteHits.set(id, arr);
  return { ok: true };
}
