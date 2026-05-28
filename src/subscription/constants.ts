import type { BillingPeriod } from './types';

/** @deprecated Global key — removed by migration v2; use subscriptionStorageKey(userId). */
export const SUBSCRIPTION_STORAGE_KEY = 'petcare_subscription_status';

/** Legacy key used by early builds — removed on migration. */
export const LEGACY_AI_PLAN_KEY = 'cat-ai-plan';

export const SUBSCRIPTION_MIGRATION_V2_KEY = 'petcare_subscription_migration_v2';

/** Per-user subscription JSON (status + metadata). */
export function subscriptionStorageKey(userId: string): string {
  return `petcare_subscription_status_${userId.trim()}`;
}

/** Global / unscoped keys that must not drive UI after logout. */
export const GLOBAL_SUBSCRIPTION_KEYS_TO_REMOVE = [
  SUBSCRIPTION_STORAGE_KEY,
  LEGACY_AI_PLAN_KEY,
  'isPro',
  'subscriptionStatus',
  'petcarePlan',
  'petcare_subscription',
  'petcare_app_plan',
  'petcare_is_pro',
  'currentPlan',
] as const;

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
  monthly: 'com.wayne.petcare.pro.monthly',
  yearly: 'com.wayne.petcare.pro.yearly',
};
