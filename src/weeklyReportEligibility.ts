import type { AssistantContext, DailyData, DayRecord } from './aiCareAssistant';
import { getDailyItemsForPetType } from './petTypes';

export const WEEKLY_MIN_DAYS_WITH_RECORDS = 3;
export const WEEKLY_MIN_CARE_ENTRIES = 5;

export type WeeklyReportDataAssessment = {
  sufficient: boolean;
  daysWithRecords: number;
  careEntryCount: number;
  hasAbnormalRecords: boolean;
};

function strField(data: DailyData, key: string): string {
  const v = data[key];
  return typeof v === 'string' ? v.trim() : '';
}

function photoCount(data: DailyData, key: 'abnormalPhotos'): number {
  const v = data[key];
  if (!Array.isArray(v)) return 0;
  return v.filter((x) => typeof x === 'string' && x.length > 0).length;
}

function dedupeRecentDays(ctx: AssistantContext): DayRecord[] {
  const all =
    ctx.recentDaysForAi.length >= 7 ? ctx.recentDaysForAi : [...ctx.last7Days, ...ctx.recentDaysForAi];
  const deduped: DayRecord[] = [];
  const seen = new Set<string>();
  for (const day of all) {
    if (seen.has(day.date)) continue;
    seen.add(day.date);
    deduped.push(day);
    if (deduped.length >= 14) break;
  }
  return deduped;
}

function countCareEntriesOnDay(data: DailyData, checkboxIds: readonly string[]): number {
  let count = 0;
  for (const id of checkboxIds) {
    if (data[id] === true) count += 1;
  }
  if (strField(data, 'abnormalNote')) count += 1;
  if (photoCount(data, 'abnormalPhotos') > 0) count += 1;
  return count;
}

function dayHasAbnormal(data: DailyData): boolean {
  return strField(data, 'abnormalNote').length > 0 || photoCount(data, 'abnormalPhotos') > 0;
}

/** Whether local care logs meet the minimum bar before calling the weekly-report API. */
export function assessWeeklyReportData(ctx: AssistantContext): WeeklyReportDataAssessment {
  const checkboxIds = getDailyItemsForPetType(ctx.petType).map((item) => item.id);
  const days = dedupeRecentDays(ctx);

  let daysWithRecords = 0;
  let careEntryCount = 0;
  let hasAbnormalRecords = false;

  for (const day of days) {
    const entries = countCareEntriesOnDay(day.data, checkboxIds);
    if (entries > 0) daysWithRecords += 1;
    careEntryCount += entries;
    if (dayHasAbnormal(day.data)) hasAbnormalRecords = true;
  }

  const sufficient =
    daysWithRecords >= WEEKLY_MIN_DAYS_WITH_RECORDS && careEntryCount >= WEEKLY_MIN_CARE_ENTRIES;

  return { sufficient, daysWithRecords, careEntryCount, hasAbnormalRecords };
}
