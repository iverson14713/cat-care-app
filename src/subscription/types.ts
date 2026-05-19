/** Subscription tier — gates all Pro features in the app. */
export type SubscriptionStatus = 'free' | 'pro';

export type BillingPeriod = 'monthly' | 'yearly';

export type PurchaseSource = 'test' | 'restore' | 'app_store';

export type PurchaseResult =
  | { ok: true; status: SubscriptionStatus; source: PurchaseSource; period?: BillingPeriod }
  | { ok: false; errorCode: PurchaseErrorCode; message?: string };

export type PurchaseErrorCode =
  | 'IAP_NOT_CONFIGURED'
  | 'USER_CANCELLED'
  | 'NO_PURCHASES'
  | 'RESTORE_FAILED'
  | 'UNKNOWN';

export type SubscriptionRecord = {
  status: SubscriptionStatus;
  /** Set when user picks monthly/yearly (for future IAP receipt matching). */
  billingPeriod?: BillingPeriod | null;
  /** ISO date when status last changed locally. */
  updatedAt: string;
  /** How Pro was activated (test unlock vs restore vs StoreKit). */
  source?: PurchaseSource | null;
};
