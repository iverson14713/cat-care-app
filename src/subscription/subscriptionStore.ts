import { safeGetItem, safeRemoveItem, safeSetItem } from '../safeStorage';
import { isPromoProActive } from '../supabasePromo';
import { getActiveStorageUserId } from '../userStorageScope';
import {
  GLOBAL_SUBSCRIPTION_KEYS_TO_REMOVE,
  LEGACY_AI_PLAN_KEY,
  SUBSCRIPTION_MIGRATION_V2_KEY,
  SUBSCRIPTION_STORAGE_KEY,
  subscriptionStorageKey,
} from './constants';
import type { PurchaseSource, SubscriptionRecord, SubscriptionStatus } from './types';

function defaultRecord(status: SubscriptionStatus = 'free'): SubscriptionRecord {
  return {
    status,
    billingPeriod: null,
    updatedAt: new Date().toISOString(),
    source: null,
    promoUntil: null,
    promoSource: null,
    redeemedCode: null,
    promoAiBonus: 0,
  };
}

function parseRecord(raw: string | null): SubscriptionRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SubscriptionRecord>;
    if (parsed.status !== 'free' && parsed.status !== 'pro') return null;
    return {
      status: parsed.status,
      billingPeriod: parsed.billingPeriod ?? null,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      source: parsed.source ?? null,
      promoUntil: parsed.promoUntil ?? null,
      promoSource: parsed.promoSource ?? null,
      redeemedCode: parsed.redeemedCode ?? null,
      promoAiBonus: Math.max(0, parsed.promoAiBonus ?? 0),
    };
  } catch {
    return null;
  }
}

function resolveUserId(explicit?: string | null): string | null {
  const uid = (explicit ?? getActiveStorageUserId())?.trim();
  return uid || null;
}

/** One-time: remove global Pro cache keys from older builds (no userId binding). */
export function runSubscriptionStorageMigrationV2(): void {
  if (safeGetItem(SUBSCRIPTION_MIGRATION_V2_KEY) === '1') return;
  for (const key of GLOBAL_SUBSCRIPTION_KEYS_TO_REMOVE) {
    safeRemoveItem(key);
  }
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k === SUBSCRIPTION_STORAGE_KEY || k === LEGACY_AI_PLAN_KEY) {
        safeRemoveItem(k);
      }
    }
  } catch {
    // ignore
  }
  safeSetItem(SUBSCRIPTION_MIGRATION_V2_KEY, '1');
  console.log('[subscription] migration v2 — removed global Pro cache keys');
}

runSubscriptionStorageMigrationV2();

function readLegacyGlobalStatus(): SubscriptionStatus | null {
  const legacy = safeGetItem(LEGACY_AI_PLAN_KEY);
  if (legacy === 'pro') return 'pro';
  if (legacy === 'free') return 'free';
  const global = parseRecord(safeGetItem(SUBSCRIPTION_STORAGE_KEY));
  return global?.status ?? null;
}

export function getSubscriptionRecord(userId?: string | null): SubscriptionRecord {
  const uid = resolveUserId(userId);
  if (!uid) {
    return defaultRecord('free');
  }

  const scoped = parseRecord(safeGetItem(subscriptionStorageKey(uid)));
  if (scoped) return scoped;

  const legacyStatus = readLegacyGlobalStatus();
  if (legacyStatus) {
    const migrated = defaultRecord(legacyStatus);
    writeSubscriptionRecord(migrated, uid);
    console.log('[subscription] migrated global plan into user scope', {
      userId: uid.slice(0, 8),
      status: legacyStatus,
    });
    return migrated;
  }

  return defaultRecord('free');
}

export function getSubscriptionStatus(userId?: string | null): SubscriptionStatus {
  const record = getSubscriptionRecord(userId);
  const uid = resolveUserId(userId);
  if (!uid && record.status === 'pro') {
    console.warn('[subscription] ignored pro without user — treating as free');
    return 'free';
  }
  if (record.status === 'pro' && record.source === 'promo' && !isPromoProActive(record.promoUntil)) {
    setSubscriptionStatus(
      'free',
      {
        source: null,
        promoUntil: null,
        promoSource: record.promoSource ?? null,
        redeemedCode: record.redeemedCode ?? null,
        promoAiBonus: record.promoAiBonus ?? 0,
      },
      uid ?? undefined
    );
    return 'free';
  }
  return record.status;
}

export function isProSubscriber(userId?: string | null): boolean {
  return getSubscriptionStatus(userId) === 'pro';
}

export function writeSubscriptionRecord(record: SubscriptionRecord, userId?: string | null): void {
  const uid = resolveUserId(userId);
  if (!uid) {
    console.warn('[subscription] skip writeSubscriptionRecord — no userId');
    return;
  }
  safeSetItem(subscriptionStorageKey(uid), JSON.stringify(record));
}

export function setSubscriptionStatus(
  status: SubscriptionStatus,
  opts?: {
    source?: PurchaseSource | null;
    billingPeriod?: SubscriptionRecord['billingPeriod'];
    promoUntil?: string | null;
    promoSource?: string | null;
    redeemedCode?: string | null;
    promoAiBonus?: number;
  },
  userId?: string | null
): SubscriptionRecord {
  const uid = resolveUserId(userId);
  if (!uid) {
    console.warn('[subscription] skip setSubscriptionStatus — no userId', { status });
    return defaultRecord('free');
  }
  const prev = getSubscriptionRecord(uid);
  const next: SubscriptionRecord = {
    status,
    billingPeriod: opts?.billingPeriod ?? prev.billingPeriod ?? null,
    updatedAt: new Date().toISOString(),
    source: opts?.source !== undefined ? opts.source : prev.source ?? null,
    promoUntil: opts?.promoUntil !== undefined ? opts.promoUntil : prev.promoUntil ?? null,
    promoSource: opts?.promoSource !== undefined ? opts.promoSource : prev.promoSource ?? null,
    redeemedCode: opts?.redeemedCode !== undefined ? opts.redeemedCode : prev.redeemedCode ?? null,
    promoAiBonus:
      opts?.promoAiBonus !== undefined ? Math.max(0, opts.promoAiBonus) : Math.max(0, prev.promoAiBonus ?? 0),
  };
  writeSubscriptionRecord(next, uid);
  console.log('[subscription] setSubscriptionStatus', {
    userId: uid.slice(0, 8),
    status,
    source: next.source,
  });
  return next;
}

/** Sign-out: drop global residue; per-user scoped key is kept for next login on same device. */
export function clearSubscriptionStateOnSignOut(userId: string | null | undefined): void {
  console.log('[subscription] signOut clearing subscription UI cache', {
    userId: userId?.slice(0, 8) ?? null,
    removed: GLOBAL_SUBSCRIPTION_KEYS_TO_REMOVE,
  });
  for (const key of GLOBAL_SUBSCRIPTION_KEYS_TO_REMOVE) {
    safeRemoveItem(key);
  }
}
