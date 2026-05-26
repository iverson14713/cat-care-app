import { isPetCareDevMode } from '../lib/petCareDevMode';
import { purchaseViaStoreKit, restoreViaStoreKit } from './iapBridge';
import { getSubscriptionStatus, isProSubscriber, setSubscriptionStatus } from './subscriptionStore';
import type { BillingPeriod, PurchaseResult, SubscriptionStatus } from './types';

export { getSubscriptionStatus, isProSubscriber, setSubscriptionStatus };
export type { BillingPeriod, PurchaseResult, SubscriptionStatus };

/**
 * Dev-only unlock — no payment. Never used in production builds.
 */
export async function purchaseProTestUnlock(period: BillingPeriod = 'monthly'): Promise<PurchaseResult> {
  if (!isPetCareDevMode()) {
    return {
      ok: false,
      errorCode: 'IAP_NOT_CONFIGURED',
      message: 'Test unlock is only available in development.',
    };
  }
  setSubscriptionStatus('pro', { source: 'test', billingPeriod: period });
  return { ok: true, status: 'pro', source: 'test', period };
}

/**
 * Production purchase — StoreKit on iOS; dev test unlock on web only.
 */
export async function purchasePro(period: BillingPeriod = 'monthly'): Promise<PurchaseResult> {
  const iap = await purchaseViaStoreKit(period);
  if (iap.ok) {
    setSubscriptionStatus('pro', {
      source: iap.source ?? 'app_store',
      billingPeriod: iap.period ?? period,
    });
    return iap;
  }
  if (iap.errorCode === 'IAP_NOT_CONFIGURED' && isPetCareDevMode()) {
    return purchaseProTestUnlock(period);
  }
  return iap;
}

/** Restore purchases (App Store requirement). */
export async function restorePurchases(): Promise<PurchaseResult> {
  const result = await restoreViaStoreKit();
  if (result.ok && result.status === 'pro') {
    setSubscriptionStatus('pro', { source: 'restore', billingPeriod: result.period ?? null });
  }
  return result;
}

export function downgradeToFree(): SubscriptionStatus {
  setSubscriptionStatus('free', { source: null, billingPeriod: null });
  return 'free';
}
