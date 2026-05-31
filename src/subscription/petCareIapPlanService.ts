import type { PetCareIapEntitlement } from '../native/petCareIap';
import { IAP_PRODUCT_IDS } from './constants';
import { getActiveIapEntitlement, isNativeIapAvailable } from './iapBridge';
import {
  getSubscriptionRecord,
  getSubscriptionStatus,
  setSubscriptionStatus,
} from './subscriptionStore';
import type { BillingPeriod, SubscriptionStatus } from './types';

function periodFromEntitlement(ent: PetCareIapEntitlement): BillingPeriod {
  if (ent.period === 'yearly' || ent.period === 'monthly') return ent.period;
  if (ent.productId === IAP_PRODUCT_IDS.yearly) return 'yearly';
  return 'monthly';
}

/**
 * Sync StoreKit entitlement → this user's local Pro status.
 * Works for guests too (userId may be "guest") so purchase is usable without sign-in.
 */
export async function syncPetCareIapForUser(userId: string): Promise<SubscriptionStatus> {
  const uid = userId.trim();
  console.log('[subscription] syncPetCareIapForUser start', { userId: uid.slice(0, 8) });

  if (!isNativeIapAvailable()) {
    const local = getSubscriptionStatus(uid);
    console.log('[subscription] IAP unavailable — using stored plan', { plan: local });
    return local;
  }

  const ent = await getActiveIapEntitlement();
  console.log('[subscription] getEntitlements', {
    isActive: ent?.isActive ?? false,
    productId: ent?.productId ?? null,
    period: ent?.period ?? null,
  });

  if (ent?.isActive && ent.productId) {
    setSubscriptionStatus(
      'pro',
      {
        source: 'app_store',
        billingPeriod: periodFromEntitlement(ent),
      },
      uid
    );
    console.log('[subscription] UI plan after IAP sync: pro');
    return 'pro';
  }

  const record = getSubscriptionRecord(uid);
  if (record.source === 'app_store' && record.status === 'pro') {
    setSubscriptionStatus('free', { source: null, billingPeriod: null }, uid);
    console.log('[subscription] UI plan after IAP sync: free (no active entitlement)');
    return 'free';
  }

  const plan = getSubscriptionStatus(uid);
  console.log('[subscription] UI plan after IAP sync:', plan, { source: record.source });
  return plan;
}

/** @deprecated Use syncPetCareIapForUser(userId) when user is known. */
export async function syncPetCareIapOnLaunch(): Promise<SubscriptionStatus | null> {
  return null;
}
