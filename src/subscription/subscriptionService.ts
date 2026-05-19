import { purchaseViaStoreKit, restoreViaStoreKit } from './iapBridge';
import { getSubscriptionStatus, isProSubscriber, setSubscriptionStatus } from './subscriptionStore';
import type { BillingPeriod, PurchaseResult, SubscriptionStatus } from './types';

export { getSubscriptionStatus, isProSubscriber, setSubscriptionStatus };
export type { BillingPeriod, PurchaseResult, SubscriptionStatus };

/**
 * Test / preview unlock — no payment. Used until StoreKit is wired.
 */
export async function purchaseProTestUnlock(period: BillingPeriod = 'monthly'): Promise<PurchaseResult> {
  setSubscriptionStatus('pro', { source: 'test', billingPeriod: period });
  return { ok: true, status: 'pro', source: 'test', period };
}

/**
 * Production purchase entry — delegates to StoreKit when available, otherwise test unlock in dev.
 */
export async function purchasePro(period: BillingPeriod = 'monthly'): Promise<PurchaseResult> {
  const iap = await purchaseViaStoreKit(period);
  if (iap.ok) return iap;
  if (iap.errorCode === 'IAP_NOT_CONFIGURED') {
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
