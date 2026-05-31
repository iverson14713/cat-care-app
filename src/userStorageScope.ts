/**
 * User-scoped localStorage — prevents cross-account data bleed on shared devices.
 */
import { safeGetItem, safeRemoveItem, safeSetItem } from './safeStorage';

export const GUEST_USER_ID = 'guest';
export const STORAGE_OWNER_KEY = 'cat-calendar-storage-owner';
const ACTIVE_USER_SESSION_KEY = 'cat-calendar-active-storage-user';

/** Legacy global keys (pre user-scope migration). */
const LEGACY_KEYS = {
  cats: 'cat-calendar-cats',
  reminders: 'cat-calendar-reminders',
  selectedCat: 'cat-calendar-selected-cat-id',
} as const;

let activeStorageUserId: string = GUEST_USER_ID;

export function normalizeStorageUserId(userId: string | null | undefined): string {
  const t = typeof userId === 'string' ? userId.trim() : '';
  return t || GUEST_USER_ID;
}

/** Set in-memory + session active user (call on login / logout / bootstrap). */
export function setActiveStorageUser(userId: string | null | undefined): void {
  activeStorageUserId = normalizeStorageUserId(userId);
  try {
    if (userId?.trim()) sessionStorage.setItem(ACTIVE_USER_SESSION_KEY, userId.trim());
    else sessionStorage.removeItem(ACTIVE_USER_SESSION_KEY);
  } catch {
    // private mode
  }
}

export function getActiveStorageUserId(): string {
  if (activeStorageUserId !== GUEST_USER_ID) return activeStorageUserId;
  try {
    const saved = sessionStorage.getItem(ACTIVE_USER_SESSION_KEY);
    if (saved?.trim()) {
      activeStorageUserId = saved.trim();
      return activeStorageUserId;
    }
  } catch {
    // ignore
  }
  return GUEST_USER_ID;
}

export function getStorageOwner(): string | null {
  const raw = safeGetItem(STORAGE_OWNER_KEY);
  return raw?.trim() || null;
}

export function setStorageOwner(userId: string): void {
  safeSetItem(STORAGE_OWNER_KEY, normalizeStorageUserId(userId));
}

export function clearStorageOwner(): void {
  safeRemoveItem(STORAGE_OWNER_KEY);
}

export type StorageOwnerCheck =
  | { ok: true }
  | { ok: false; code: 'storage_owner_mismatch'; storedOwner: string; expectedUserId: string };

/** Block cloud sync when persisted owner ≠ signed-in user. */
export function assertStorageOwnerMatches(expectedUserId: string): StorageOwnerCheck {
  const expected = normalizeStorageUserId(expectedUserId);
  if (expected === GUEST_USER_ID) return { ok: true };
  const owner = getStorageOwner();
  if (owner && owner !== expected) {
    return { ok: false, code: 'storage_owner_mismatch', storedOwner: owner, expectedUserId: expected };
  }
  return { ok: true };
}

export function catsStorageKey(userId?: string): string {
  return `cat-calendar-cats-${normalizeStorageUserId(userId ?? getActiveStorageUserId())}`;
}

export function selectedCatStorageKey(userId?: string): string {
  return `cat-calendar-selected-cat-${normalizeStorageUserId(userId ?? getActiveStorageUserId())}`;
}

export function remindersStorageKey(userId?: string): string {
  return `cat-calendar-reminders-${normalizeStorageUserId(userId ?? getActiveStorageUserId())}`;
}

export function dailyStorageKey(catId: string, date: string, userId?: string): string {
  const uid = normalizeStorageUserId(userId ?? getActiveStorageUserId());
  return `cat-calendar-daily-${uid}-${catId}-${date}`;
}

export function monthlyStorageKey(catId: string, month: string, userId?: string): string {
  const uid = normalizeStorageUserId(userId ?? getActiveStorageUserId());
  return `cat-calendar-monthly-${uid}-${catId}-${month}`;
}

export function weightStorageKey(catId: string, userId?: string): string {
  const uid = normalizeStorageUserId(userId ?? getActiveStorageUserId());
  return `cat-calendar-weights-${uid}-${catId}`;
}

export function weeklyReportStorageKey(catId: string, weekEnd: string, userId?: string): string {
  const uid = normalizeStorageUserId(userId ?? getActiveStorageUserId());
  return `weekly-ai-report-${uid}-${catId}-${weekEnd}`;
}

export function aiUsageStorageKey(clientId: string, usageDate: string, userId?: string): string {
  const uid = normalizeStorageUserId(userId ?? getActiveStorageUserId());
  return `ai-usage-${uid}-${usageDate}`;
}

export function careBundleCachePrefix(userId?: string): string {
  const uid = normalizeStorageUserId(userId ?? getActiveStorageUserId());
  return `cat-ai-care:v2:${uid}:`;
}

function listKeysMatching(predicate: (key: string) => boolean): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && predicate(k)) keys.push(k);
    }
  } catch {
    // ignore
  }
  return keys;
}

const UUID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;

function isUserScopedDailyKey(key: string): boolean {
  const after = key.slice('cat-calendar-daily-'.length);
  return after.startsWith(`${GUEST_USER_ID}-`) || UUID_PREFIX.test(after);
}

function isLegacyDailyKey(key: string): boolean {
  return key.startsWith('cat-calendar-daily-') && !isUserScopedDailyKey(key);
}

function isLegacyMonthlyKey(key: string): boolean {
  if (!key.startsWith('cat-calendar-monthly-')) return false;
  const after = key.slice('cat-calendar-monthly-'.length);
  return !after.startsWith(`${GUEST_USER_ID}-`) && !UUID_PREFIX.test(after);
}

function isLegacyWeightKey(key: string): boolean {
  if (!key.startsWith('cat-calendar-weights-')) return false;
  const after = key.slice('cat-calendar-weights-'.length);
  return !after.startsWith(`${GUEST_USER_ID}-`) && !UUID_PREFIX.test(after);
}

function isLegacyWeeklyKey(key: string): boolean {
  if (!key.startsWith('weekly-ai-report-')) return false;
  const after = key.slice('weekly-ai-report-'.length);
  return !after.startsWith(`${GUEST_USER_ID}-`) && !UUID_PREFIX.test(after);
}

function isLegacyAiUsageKey(key: string): boolean {
  return /^ai-usage-\d{4}-\d{2}-\d{2}$/.test(key);
}

function isLegacyGlobalKey(key: string): boolean {
  if (key === LEGACY_KEYS.cats || key === LEGACY_KEYS.reminders || key === LEGACY_KEYS.selectedCat) {
    return true;
  }
  return (
    isLegacyDailyKey(key) ||
    isLegacyMonthlyKey(key) ||
    isLegacyWeightKey(key) ||
    isLegacyWeeklyKey(key) ||
    isLegacyAiUsageKey(key)
  );
}

function isUserScopedKey(key: string, userId: string): boolean {
  const uid = normalizeStorageUserId(userId);
  return (
    key === catsStorageKey(uid) ||
    key === remindersStorageKey(uid) ||
    key === selectedCatStorageKey(uid) ||
    key.startsWith(`cat-calendar-daily-${uid}-`) ||
    key.startsWith(`cat-calendar-monthly-${uid}-`) ||
    key.startsWith(`cat-calendar-weights-${uid}-`) ||
    key.startsWith(`weekly-ai-report-${uid}-`) ||
    key.startsWith(`ai-usage-${uid}-`)
  );
}

function catsBelongToUser(rawCats: unknown[], userId: string): boolean {
  if (!Array.isArray(rawCats) || rawCats.length === 0) return true;
  return rawCats.every((raw) => {
    if (!raw || typeof raw !== 'object') return true;
    const o = raw as Record<string, unknown>;
    const owner =
      (typeof o.ownerId === 'string' && o.ownerId) ||
      (typeof o.owner_id === 'string' && o.owner_id) ||
      '';
    return !owner || owner === userId;
  });
}

export type PrepareStorageResult =
  | { ok: true; migrated: boolean }
  | { ok: false; code: 'storage_owner_mismatch'; storedOwner: string };

/**
 * On login: bind storage to user, migrate legacy keys if safe, or block if another user's data.
 */
export function prepareStorageForUser(userId: string): PrepareStorageResult {
  const uid = normalizeStorageUserId(userId);
  setActiveStorageUser(uid);

  const ownerCheck = assertStorageOwnerMatches(uid);
  if (!ownerCheck.ok) {
    return { ok: false, code: 'storage_owner_mismatch', storedOwner: ownerCheck.storedOwner };
  }

  const legacyCatsRaw = safeGetItem(LEGACY_KEYS.cats);
  let legacyCats: unknown[] = [];
  if (legacyCatsRaw) {
    try {
      const parsed = JSON.parse(legacyCatsRaw) as unknown;
      legacyCats = Array.isArray(parsed) ? parsed : [];
    } catch {
      legacyCats = [];
    }
  }

  const existingOwner = getStorageOwner();
  const hasLegacy =
    legacyCatsRaw != null ||
    safeGetItem(LEGACY_KEYS.reminders) != null ||
    listKeysMatching((k) => isLegacyGlobalKey(k)).length > 0;

  if (hasLegacy && !catsBelongToUser(legacyCats, uid)) {
    clearLegacyGlobalStorage();
    setStorageOwner(uid);
    return { ok: true, migrated: false };
  }

  let migrated = false;
  if (hasLegacy) {
    migrateLegacyToUserScope(uid);
    migrated = true;
  }

  if (!existingOwner) setStorageOwner(uid);
  else setStorageOwner(uid);

  return { ok: true, migrated };
}

function migrateLegacyToUserScope(userId: string): void {
  const uid = normalizeStorageUserId(userId);

  const legacyCats = safeGetItem(LEGACY_KEYS.cats);
  if (legacyCats && !safeGetItem(catsStorageKey(uid))) {
    safeSetItem(catsStorageKey(uid), legacyCats);
  }
  safeRemoveItem(LEGACY_KEYS.cats);

  const legacyRem = safeGetItem(LEGACY_KEYS.reminders);
  if (legacyRem && !safeGetItem(remindersStorageKey(uid))) {
    safeSetItem(remindersStorageKey(uid), legacyRem);
  }
  safeRemoveItem(LEGACY_KEYS.reminders);

  const legacySel = safeGetItem(LEGACY_KEYS.selectedCat);
  if (legacySel && !safeGetItem(selectedCatStorageKey(uid))) {
    safeSetItem(selectedCatStorageKey(uid), legacySel);
  }
  safeRemoveItem(LEGACY_KEYS.selectedCat);

  for (const key of listKeysMatching((k) => isLegacyGlobalKey(k))) {
    if (key.startsWith('cat-calendar-daily-')) {
      const rest = key.slice('cat-calendar-daily-'.length);
      const dateMatch = rest.match(/(\d{4}-\d{2}-\d{2})$/);
      if (!dateMatch) continue;
      const date = dateMatch[1]!;
      const catId = rest.slice(0, rest.length - date.length - 1);
      const v = safeGetItem(key);
      if (v) safeSetItem(dailyStorageKey(catId, date, uid), v);
      safeRemoveItem(key);
      continue;
    }
    if (key.startsWith('cat-calendar-monthly-')) {
      const rest = key.slice('cat-calendar-monthly-'.length);
      const monthMatch = rest.match(/(\d{4}-\d{2})$/);
      if (!monthMatch) continue;
      const month = monthMatch[1]!;
      const catId = rest.slice(0, rest.length - month.length - 1);
      const v = safeGetItem(key);
      if (v) safeSetItem(monthlyStorageKey(catId, month, uid), v);
      safeRemoveItem(key);
      continue;
    }
    if (key.startsWith('cat-calendar-weights-')) {
      const catId = key.slice('cat-calendar-weights-'.length);
      const v = safeGetItem(key);
      if (v) safeSetItem(weightStorageKey(catId, uid), v);
      safeRemoveItem(key);
      continue;
    }
    if (key.startsWith('weekly-ai-report-')) {
      const rest = key.slice('weekly-ai-report-'.length);
      const dateMatch = rest.match(/(\d{4}-\d{2}-\d{2})$/);
      if (!dateMatch) continue;
      const weekEnd = dateMatch[1]!;
      const catId = rest.slice(0, rest.length - weekEnd.length - 1);
      const v = safeGetItem(key);
      if (v) safeSetItem(weeklyReportStorageKey(catId, weekEnd, uid), v);
      safeRemoveItem(key);
      continue;
    }
    if (/^ai-usage-\d{4}-\d{2}-\d{2}$/.test(key)) {
      const date = key.slice('ai-usage-'.length);
      const v = safeGetItem(key);
      if (v) safeSetItem(aiUsageStorageKey('legacy', date, uid), v);
      safeRemoveItem(key);
    }
  }
}

/** Remove all local keys for one user (call on sign-out). */
export function clearUserScopedStorage(userId: string): void {
  const uid = normalizeStorageUserId(userId);
  for (const key of listKeysMatching((k) => isUserScopedKey(k, uid))) {
    safeRemoveItem(key);
  }
  clearCareBundleSessionCache(uid);
}

export function clearLegacyGlobalStorage(): void {
  safeRemoveItem(LEGACY_KEYS.cats);
  safeRemoveItem(LEGACY_KEYS.reminders);
  safeRemoveItem(LEGACY_KEYS.selectedCat);
  for (const key of listKeysMatching((k) => isLegacyGlobalKey(k))) {
    safeRemoveItem(key);
  }
}

export function clearCareBundleSessionCache(userId?: string): void {
  const uid = normalizeStorageUserId(userId ?? getActiveStorageUserId());
  const prefix = careBundleCachePrefix(uid);
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(prefix)) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
    // legacy session cache without user prefix
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k?.startsWith('cat-ai-care:v2:') && !k.startsWith(prefix)) {
        sessionStorage.removeItem(k);
      }
    }
  } catch {
    // ignore
  }
}

/** Full logout cleanup for the signing-out user. */
export function clearAllLocalDataOnSignOut(userId: string | null | undefined): void {
  if (userId?.trim()) clearUserScopedStorage(userId.trim());
  clearLegacyGlobalStorage();
  clearStorageOwner();
  setActiveStorageUser(null);
  safeRemoveItem('cat-care-display-name');
}

async function deleteIndexedDbBestEffort(): Promise<void> {
  try {
    const idbAny = indexedDB as unknown as {
      databases?: () => Promise<{ name?: string | null }[]>;
      deleteDatabase: (name: string) => IDBOpenDBRequest;
    };
    const dbs = (await idbAny.databases?.()) ?? [];
    const names = dbs
      .map((d) => (typeof d?.name === 'string' ? d.name : ''))
      .filter((n) => n && n !== '__proto__');
    await Promise.all(
      names.map(
        (name) =>
          new Promise<void>((resolve) => {
            try {
              const req = idbAny.deleteDatabase(name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            } catch {
              resolve();
            }
          })
      )
    );
  } catch {
    // ignore
  }
}

async function clearCacheStorageBestEffort(): Promise<void> {
  try {
    const c = (globalThis as unknown as { caches?: CacheStorage }).caches;
    if (!c) return;
    const keys = await c.keys();
    await Promise.all(keys.map((k) => c.delete(k)));
  } catch {
    // ignore
  }
}

async function unregisterServiceWorkersBestEffort(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return;
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    // ignore
  }
}

/**
 * Hard clear ALL browser storage for this app origin.
 * Use on sign-out / account deletion to prevent cross-account leakage.
 */
export async function hardClearAllClientStorage(): Promise<void> {
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
  try {
    sessionStorage.clear();
  } catch {
    // ignore
  }
  await Promise.all([
    deleteIndexedDbBestEffort(),
    clearCacheStorageBestEffort(),
    unregisterServiceWorkersBestEffort(),
  ]);
  // Ensure our in-memory active user is reset even if sessionStorage clearing failed.
  setActiveStorageUser(null);
}

export function listLocalDailyDatesForCat(catId: string, userId?: string): string[] {
  const uid = normalizeStorageUserId(userId ?? getActiveStorageUserId());
  const prefix = `cat-calendar-daily-${uid}-${catId}-`;
  const dates: string[] = [];
  for (const key of listKeysMatching((k) => k.startsWith(prefix))) {
    dates.push(key.slice(prefix.length));
  }
  return dates;
}

export function listLocalMonthlyKeysForCat(catId: string, userId?: string): string[] {
  const uid = normalizeStorageUserId(userId ?? getActiveStorageUserId());
  const prefix = `cat-calendar-monthly-${uid}-${catId}-`;
  const months: string[] = [];
  for (const key of listKeysMatching((k) => k.startsWith(prefix))) {
    months.push(key.slice(prefix.length));
  }
  return months;
}
