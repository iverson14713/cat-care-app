export type AppPlan = 'free' | 'pro';

export const FREE_MAX_ACTIVE_PETS = 3;
export const FREE_HISTORY_SEARCH_DAYS = 30;
export const MAX_PHOTOS_FREE = 3;
/** Pro: higher daily photo slots per slot type (daily / abnormal). */
export const MAX_PHOTOS_PRO = 24;

export function getMaxDailyPhotos(plan: AppPlan): number {
  return plan === 'pro' ? MAX_PHOTOS_PRO : MAX_PHOTOS_FREE;
}

export function getFreeHistorySearchDateFloor(todayYmd: string): string {
  const d = new Date(`${todayYmd}T12:00:00`);
  d.setDate(d.getDate() - (FREE_HISTORY_SEARCH_DAYS - 1));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
