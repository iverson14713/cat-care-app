import type { PromoEntitlement } from '../supabasePromo';
import { isPromoProActive } from '../supabasePromo';
import {
  getSubscriptionRecord,
  getSubscriptionStatus,
  setSubscriptionStatus,
} from './subscriptionStore';
import type { SubscriptionStatus } from './types';

function resolveUserId(userId?: string | null): string | null {
  const uid = userId?.trim();
  return uid || null;
}

export function applyPromoEntitlementToLocal(
  entitlement: PromoEntitlement,
  userId: string
): SubscriptionStatus {
  const uid = resolveUserId(userId);
  if (!uid) return 'free';

  const record = getSubscriptionRecord(uid);
  const promoActive = isPromoProActive(entitlement.promoProUntil);

  if (record.source === 'app_store' && record.status === 'pro') {
    writePromoMetadata(entitlement, uid, 'pro');
    return 'pro';
  }

  if (record.status === 'pro' && record.source && record.source !== 'promo') {
    writePromoMetadata(entitlement, uid, 'pro');
    return 'pro';
  }

  if (promoActive) {
    setSubscriptionStatus(
      'pro',
      {
        source: 'promo',
        promoUntil: entitlement.promoProUntil,
        promoSource: entitlement.promoSource,
        redeemedCode: entitlement.redeemedCode,
        promoAiBonus: entitlement.promoAiBonus,
      },
      uid
    );
    return 'pro';
  }

  writePromoMetadata(entitlement, uid, record.source === 'promo' ? 'free' : record.status);

  if (record.source === 'promo' && record.status === 'pro') {
    setSubscriptionStatus(
      'free',
      {
        source: null,
        promoUntil: null,
        promoSource: entitlement.promoSource,
        redeemedCode: entitlement.redeemedCode,
        promoAiBonus: entitlement.promoAiBonus,
      },
      uid
    );
    return 'free';
  }

  return getSubscriptionStatus(uid);
}

function writePromoMetadata(
  entitlement: PromoEntitlement,
  userId: string,
  status: SubscriptionStatus
): void {
  const record = getSubscriptionRecord(userId);
  setSubscriptionStatus(
    status,
    {
      source: record.source ?? null,
      billingPeriod: record.billingPeriod ?? null,
      promoUntil: entitlement.promoProUntil,
      promoSource: entitlement.promoSource,
      redeemedCode: entitlement.redeemedCode,
      promoAiBonus: entitlement.promoAiBonus,
    },
    userId
  );
}

export function clearExpiredPromoIfNeeded(userId: string): SubscriptionStatus {
  const record = getSubscriptionRecord(userId);
  if (record.source !== 'promo' || record.status !== 'pro') {
    return getSubscriptionStatus(userId);
  }
  if (isPromoProActive(record.promoUntil)) {
    return 'pro';
  }
  setSubscriptionStatus(
    'free',
    {
      source: null,
      promoUntil: null,
      promoSource: record.promoSource ?? null,
      redeemedCode: record.redeemedCode ?? null,
      promoAiBonus: record.promoAiBonus ?? 0,
    },
    userId
  );
  return 'free';
}

export function getPromoAiBonus(userId?: string | null): number {
  return Math.max(0, getSubscriptionRecord(userId).promoAiBonus ?? 0);
}
