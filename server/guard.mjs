import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USAGE_PERSIST_FILE = path.join(__dirname, 'logs', 'ai-daily-usage.json');

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

export function trustClientPlan() {
  if (process.env.NODE_ENV !== 'production') return true;
  const v = (process.env.AI_TRUST_CLIENT_PLAN || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * @param {string} clientId
 * @param {'free' | 'pro'} [planFromRequest='free'] — from client body/query when testing (see AI_TRUST_CLIENT_PLAN).
 */
export function getDailyLimit(clientId, planFromRequest = 'free') {
  if (typeof clientId !== 'string' || !clientId.trim()) return freeLimit();
  if (proClientSet().has(clientId.trim())) return proLimit();
  if (trustClientPlan() && planFromRequest === 'pro') return proLimit();
  return freeLimit();
}

/** For health JSON: whether this client+hint is treated as Pro tier (quota / UI). */
export function effectivePlanForResponse(clientId, planFromRequest = 'free') {
  if (typeof clientId === 'string' && proClientSet().has(clientId.trim())) return 'pro';
  if (trustClientPlan() && planFromRequest === 'pro') return 'pro';
  return 'free';
}

const dailyUsage = new Map();
const minuteHits = new Map();

function dailyKey(clientId, usageDate) {
  return `${clientId}|${usageDate}`;
}

function loadPersistedDailyUsage() {
  if (process.env.VERCEL) return;
  try {
    if (!fs.existsSync(USAGE_PERSIST_FILE)) return;
    const raw = fs.readFileSync(USAGE_PERSIST_FILE, 'utf8');
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      const n = Number(v);
      if (typeof k === 'string' && Number.isFinite(n) && n >= 0) {
        dailyUsage.set(k, Math.floor(n));
      }
    }
  } catch (e) {
    console.error('[guard] load ai-daily-usage', e);
  }
}

function persistDailyUsageToDisk() {
  if (process.env.VERCEL) return;
  try {
    const dir = path.dirname(USAGE_PERSIST_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USAGE_PERSIST_FILE, JSON.stringify(Object.fromEntries(dailyUsage)), 'utf8');
  } catch (e) {
    console.error('[guard] save ai-daily-usage', e);
  }
}

loadPersistedDailyUsage();

export function peekDailyUsed(clientId, usageDate) {
  return dailyUsage.get(dailyKey(clientId, usageDate)) || 0;
}

export function incrementDailyUsed(clientId, usageDate) {
  const k = dailyKey(clientId, usageDate);
  dailyUsage.set(k, (dailyUsage.get(k) || 0) + 1);
  persistDailyUsageToDisk();
}

/** @returns {{ ok: true, used: number, limit: number, remaining: number } | { ok: false, code: 'QUOTA', used: number, limit: number, remaining: number }} */
export function assertDailyQuota(clientId, usageDate, planFromRequest = 'free') {
  const limit = getDailyLimit(clientId, planFromRequest);
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
