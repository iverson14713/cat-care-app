import { safeGetItem, safeSetItem } from '../safeStorage';
import { LEGACY_AI_PLAN_KEY, SUBSCRIPTION_STORAGE_KEY } from './constants';
import type { PurchaseSource, SubscriptionRecord, SubscriptionStatus } from './types';

function defaultRecord(status: SubscriptionStatus = 'free'): SubscriptionRecord {
  return {
    status,
    billingPeriod: null,
    updatedAt: new Date().toISOString(),
    source: null,
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
    };
  } catch {
    return null;
  }
}

function readLegacyStatus(): SubscriptionStatus | null {
  const legacy = safeGetItem(LEGACY_AI_PLAN_KEY);
  if (legacy === 'pro') return 'pro';
  if (legacy === 'free') return 'free';
  return null;
}

export function getSubscriptionRecord(): SubscriptionRecord {
  const parsed = parseRecord(safeGetItem(SUBSCRIPTION_STORAGE_KEY));
  if (parsed) return parsed;
  const legacy = readLegacyStatus();
  if (legacy) {
    const migrated = defaultRecord(legacy);
    writeSubscriptionRecord(migrated);
    return migrated;
  }
  return defaultRecord('free');
}

export function getSubscriptionStatus(): SubscriptionStatus {
  return getSubscriptionRecord().status;
}

export function isProSubscriber(): boolean {
  return getSubscriptionStatus() === 'pro';
}

export function writeSubscriptionRecord(record: SubscriptionRecord): void {
  safeSetItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(record));
  // Keep legacy key in sync for any code still reading cat-ai-plan directly.
  if (record.status === 'pro') safeSetItem(LEGACY_AI_PLAN_KEY, 'pro');
  else safeSetItem(LEGACY_AI_PLAN_KEY, 'free');
}

export function setSubscriptionStatus(
  status: SubscriptionStatus,
  opts?: { source?: PurchaseSource | null; billingPeriod?: SubscriptionRecord['billingPeriod'] }
): SubscriptionRecord {
  const next: SubscriptionRecord = {
    status,
    billingPeriod: opts?.billingPeriod ?? null,
    updatedAt: new Date().toISOString(),
    source: opts?.source ?? null,
  };
  writeSubscriptionRecord(next);
  return next;
}
