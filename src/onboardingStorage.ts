import { safeGetItem, safeSetItem } from './safeStorage';

export const ONBOARDING_STORAGE_KEY = 'petcare_onboarding_done';

export function isOnboardingDone(): boolean {
  return safeGetItem(ONBOARDING_STORAGE_KEY) === '1';
}

export function markOnboardingDone(): void {
  safeSetItem(ONBOARDING_STORAGE_KEY, '1');
}
