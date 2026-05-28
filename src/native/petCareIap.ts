import { registerPlugin } from '@capacitor/core';
import type { BillingPeriod } from '../subscription/types';
import { IAP_PRODUCT_IDS } from '../subscription/constants';

export type PetCareIapProduct = {
  productId: string;
  displayName?: string;
  displayPrice: string;
  /** Numeric price from StoreKit (storefront currency). */
  price?: number;
  currencyCode?: string;
  subscriptionPeriod?: string;
  storefrontLocale?: string;
  period: BillingPeriod;
};

export type PetCareIapEntitlement = {
  productId?: string;
  period?: BillingPeriod;
  isActive: boolean;
  expiresAt?: string | null;
  originalTransactionId?: string;
  transactionId?: string;
};

export interface PetCareIapPlugin {
  getProducts(): Promise<{ products: PetCareIapProduct[] }>;
  purchase(options: { productId: string }): Promise<PetCareIapEntitlement>;
  restorePurchases(): Promise<PetCareIapEntitlement>;
  getEntitlements(): Promise<PetCareIapEntitlement>;
}

const PetCareIAP = registerPlugin<PetCareIapPlugin>('PetCareIAP', {
  web: () => import('./petCareIap.web').then((m) => m.default),
});

export function iapProductIdForPeriod(period: BillingPeriod): string {
  return IAP_PRODUCT_IDS[period];
}

export default PetCareIAP;
