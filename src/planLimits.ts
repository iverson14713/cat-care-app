import type { SubscriptionStatus } from './subscription/types';

/** @alias SubscriptionStatus — used across feature gates */
export type AppPlan = SubscriptionStatus;

export const FREE_MAX_ACTIVE_PETS = 3;
export const MAX_PHOTOS_FREE = 3;
/** Pro: higher daily photo slots per slot type (daily / abnormal). */
export const MAX_PHOTOS_PRO = 24;

export function getMaxDailyPhotos(plan: AppPlan): number {
  return plan === 'pro' ? MAX_PHOTOS_PRO : MAX_PHOTOS_FREE;
}
