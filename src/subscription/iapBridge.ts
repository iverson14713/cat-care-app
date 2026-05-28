/**
 * Apple In-App Purchase / StoreKit 2 (iOS native plugin).
 */
import { Capacitor } from '@capacitor/core';
import PetCareIAP, { iapProductIdForPeriod, type PetCareIapEntitlement } from '../native/petCareIap';
import { IAP_PRODUCT_IDS } from './constants';
import type { BillingPeriod, PurchaseResult } from './types';

export function isNativeIapAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

function periodFromProductId(productId: string | undefined): BillingPeriod | undefined {
  if (!productId) return undefined;
  if (productId === IAP_PRODUCT_IDS.yearly) return 'yearly';
  if (productId === IAP_PRODUCT_IDS.monthly) return 'monthly';
  return undefined;
}

function entitlementToResult(
  entitlement: PetCareIapEntitlement,
  source: 'app_store' | 'restore'
): PurchaseResult {
  if (!entitlement.isActive && entitlement.productId == null) {
    return { ok: false, errorCode: 'NO_PURCHASES', message: 'No active subscription' };
  }
  const period = entitlement.period ?? periodFromProductId(entitlement.productId);
  return {
    ok: true,
    status: 'pro',
    source,
    period,
  };
}

function mapPluginError(e: unknown): PurchaseResult {
  const err = e as Error & { code?: string };
  const code = err?.code ?? '';
  if (code === 'CANCELED') {
    return { ok: false, errorCode: 'USER_CANCELLED' };
  }
  if (code === 'NO_PURCHASES') {
    return { ok: false, errorCode: 'NO_PURCHASES' };
  }
  if (code === 'IAP_NOT_AVAILABLE' || code === 'PRODUCTS_FAILED') {
    return { ok: false, errorCode: 'IAP_NOT_CONFIGURED' };
  }
  return { ok: false, errorCode: 'UNKNOWN' };
}

export async function getActiveIapEntitlement(): Promise<PetCareIapEntitlement | null> {
  if (!isNativeIapAvailable()) return null;
  try {
    const ent = await PetCareIAP.getEntitlements();
    if (ent.isActive && ent.productId) return ent;
    return null;
  } catch {
    return null;
  }
}

export async function purchaseViaStoreKit(period: BillingPeriod): Promise<PurchaseResult> {
  if (!isNativeIapAvailable()) {
    return { ok: false, errorCode: 'IAP_NOT_CONFIGURED' };
  }

  try {
    const productId = iapProductIdForPeriod(period);
    const entitlement = await PetCareIAP.purchase({ productId });
    const result = entitlementToResult(entitlement, 'app_store');
    if (result.ok) {
      return { ...result, period: result.period ?? period };
    }
    return result;
  } catch (e) {
    return mapPluginError(e);
  }
}

export async function restoreViaStoreKit(): Promise<PurchaseResult> {
  if (!isNativeIapAvailable()) {
    return { ok: false, errorCode: 'IAP_NOT_CONFIGURED' };
  }

  try {
    const entitlement = await PetCareIAP.restorePurchases();
    return entitlementToResult(entitlement, 'restore');
  } catch (e) {
    return mapPluginError(e);
  }
}

/** @deprecated Use loadStoreProductPrices from ./storeProductPrices */
export async function fetchStoreProductPrices(): Promise<Partial<Record<BillingPeriod, string>>> {
  const { loadStoreProductPrices } = await import('./storeProductPrices');
  const r = await loadStoreProductPrices('zh');
  return r.status === 'ready' ? r.prices : {};
}
