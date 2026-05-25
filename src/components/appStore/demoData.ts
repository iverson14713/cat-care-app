import { getDailyItemsForPetType } from '../../petTypes';
import { appStoreZh } from './appStoreCopy';

export const DEMO_CAT = {
  id: 'demo-maomao',
  name: '毛毛',
  emoji: '🐱',
} as const;

export const DEMO_DATE = '2026-05-19';

/** 6 of 8 daily items done → 75% */
export const DEMO_DAILY_DONE_IDS = new Set([
  'feedMorning',
  'feedNight',
  'litterMorning',
  'litterNight',
  'pee',
  'poop',
]);

export const DEMO_DAILY_ITEMS = getDailyItemsForPetType('cat');

export const DEMO_DAILY_PERCENT = Math.round(
  (DEMO_DAILY_DONE_IDS.size / DEMO_DAILY_ITEMS.length) * 100
);

export const DEMO_ABNORMAL_NOTE = '今天精神良好，食慾正常，排便狀況穩定。';

export function labelForDailyItem(labelKey: string): string {
  return appStoreZh[labelKey as keyof typeof appStoreZh] ?? labelKey;
}
