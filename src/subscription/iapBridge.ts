/**
 * Apple In-App Purchase / StoreKit integration boundary.
 *
 * This web build has no native StoreKit runtime. When you ship a Capacitor /
 * React Native shell, implement these functions using StoreKit 2 or your IAP plugin,
 * then call `setSubscriptionStatus('pro', { source: 'app_store', ... })` on success.
 */
import { IAP_PRODUCT_IDS } from './constants';
import { getSubscriptionStatus } from './subscriptionStore';
import type { BillingPeriod, PurchaseResult } from './types';

export function isNativeIapAvailable(): boolean {
  // TODO: return true when `window.Capacitor` / StoreKit bridge is registered.
  return false;
}

/**
 * Start App Store purchase flow for the given period.
 * @implementation StoreKit — replace body when native layer exists.
 */
export async function purchaseViaStoreKit(_period: BillingPeriod): Promise<PurchaseResult> {
  void IAP_PRODUCT_IDS;
  return {
    ok: false,
    errorCode: 'IAP_NOT_CONFIGURED',
    message: 'App Store billing is not connected in this build.',
  };
}

/**
 * Restore previous App Store purchases (required by App Review).
 * @implementation StoreKit `restoreCompletedTransactions` / Transaction.currentEntitlements
 */
export async function restoreViaStoreKit(): Promise<PurchaseResult> {
  if (!isNativeIapAvailable()) {
    // Web / test: only restore if we already have a local Pro flag (e.g. test unlock).
    if (getSubscriptionStatus() === 'pro') {
      return { ok: true, status: 'pro', source: 'restore' };
    }
    return {
      ok: false,
      errorCode: 'IAP_NOT_CONFIGURED',
      message: 'Restore requires the App Store build.',
    };
  }
  // TODO: native restore → validate receipt → return pro
  return { ok: false, errorCode: 'NO_PURCHASES' };
}
