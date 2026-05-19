import type { BillingPeriod } from './types';

/** localStorage key for subscription JSON (status + metadata). */
export const SUBSCRIPTION_STORAGE_KEY = 'petcare_subscription_status';

/** Legacy key used by early builds — read for migration only. */
export const LEGACY_AI_PLAN_KEY = 'cat-ai-plan';

export const SUBSCRIPTION_PRICING = {
  monthly: { amountTwd: 69, labelZh: 'NT$69 / 月', labelEn: 'NT$69 / month' },
  yearly: { amountTwd: 649, labelZh: 'NT$649 / 年', labelEn: 'NT$649 / year' },
  yearlySaveZh: '省約 22%',
  yearlySaveEn: 'Save ~22%',
} as const;

/**
 * App Store Connect product identifiers — wire these in StoreKit / native IAP layer.
 * @see src/subscription/iapBridge.ts
 */
export const IAP_PRODUCT_IDS: Record<BillingPeriod, string> = {
  monthly: 'com.petcare.pro.monthly',
  yearly: 'com.petcare.pro.yearly',
};
