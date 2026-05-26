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
 * On iOS launch, sync StoreKit entitlement → local Pro status.
 * Does not downgrade `test` unlocks; only clears Pro when source was App Store.
 */
export async function syncPetCareIapOnLaunch(): Promise<SubscriptionStatus | null> {
  if (!isNativeIapAvailable()) return null;

  const ent = await getActiveIapEntitlement();
  if (ent?.isActive && ent.productId) {
    setSubscriptionStatus('pro', {
      source: 'app_store',
      billingPeriod: periodFromEntitlement(ent),
    });
    return 'pro';
  }

  const record = getSubscriptionRecord();
  if (record.source === 'app_store' && record.status === 'pro') {
    setSubscriptionStatus('free', { source: null, billingPeriod: null });
    return 'free';
  }

  return getSubscriptionStatus();
}
