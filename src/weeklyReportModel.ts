import type { AssistantWeeklyReportJson } from './aiCareAssistant';

export type Lang = 'zh' | 'en';

const DEFAULTS: Record<Lang, AssistantWeeklyReportJson> = {
  zh: {
    weekSummary: '目前無法產生本週總結。',
    completionRate: '目前無法評估照護完成度。',
    trends: '目前無法整理趨勢。',
    abnormalTimeline: '本週無異常紀錄或資料不足。',
    weightChange: '本週無體重紀錄。',
    vsLastWeek: '上週資料不足，無法比較。',
    nextWeekFocus: '請持續記錄餵食、喝水與排泄。',
  },
  en: {
    weekSummary: 'Could not produce the weekly summary.',
    completionRate: 'Could not assess logging completion.',
    trends: 'Could not summarize trends.',
    abnormalTimeline: 'No abnormal timeline or insufficient data.',
    weightChange: 'No weight entries this week.',
    vsLastWeek: 'Not enough prior-week data to compare.',
    nextWeekFocus: 'Keep logging meals, water, and litter.',
  },
};

function coerceString(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (v == null) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v).trim();
  return '';
}

function pickField(obj: Record<string, unknown>, keys: string[], fallback: string): string {
  for (const k of keys) {
    const s = coerceString(obj[k]);
    if (s) return s;
  }
  return fallback;
}

/** Ensure every section is a non-empty string (legacy watchItems → abnormalTimeline, etc.). */
export function normalizeWeeklyReport(
  input: unknown,
  lang: Lang = 'zh'
): AssistantWeeklyReportJson {
  const d = DEFAULTS[lang];
  let obj: Record<string, unknown> = {};
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    obj = input as Record<string, unknown>;
  }

  return {
    weekSummary: pickField(obj, ['weekSummary', 'weeklySummary', 'summary'], d.weekSummary),
    completionRate: pickField(obj, ['completionRate', 'completion', 'loggingCompletion'], d.completionRate),
    trends: pickField(obj, ['trends', 'trend'], d.trends),
    abnormalTimeline: pickField(
      obj,
      ['abnormalTimeline', 'abnormal', 'watchItems', 'timeline'],
      d.abnormalTimeline
    ),
    weightChange: pickField(obj, ['weightChange', 'weight', 'weightTrend'], d.weightChange),
    vsLastWeek: pickField(obj, ['vsLastWeek', 'compareLastWeek', 'lastWeekCompare'], d.vsLastWeek),
    nextWeekFocus: pickField(obj, ['nextWeekFocus', 'nextWeek', 'loggingFocus'], d.nextWeekFocus),
  };
}

export function weeklySectionText(report: AssistantWeeklyReportJson | null | undefined, key: keyof AssistantWeeklyReportJson): string {
  if (!report) return '';
  const v = report[key];
  return typeof v === 'string' ? v.trim() : '';
}

export function weeklyReportHasContent(report: AssistantWeeklyReportJson | null | undefined): boolean {
  if (!report) return false;
  const keys: (keyof AssistantWeeklyReportJson)[] = [
    'weekSummary',
    'completionRate',
    'trends',
    'abnormalTimeline',
    'weightChange',
    'vsLastWeek',
    'nextWeekFocus',
  ];
  return keys.some((k) => weeklySectionText(report, k).length > 0);
}

export const WEEKLY_FAIL_ZH = 'AI 週報暫時無法產生，請稍後再試。';
export const WEEKLY_FAIL_EN = 'The AI weekly report is temporarily unavailable. Please try again later.';

export function weeklyFailMessage(lang: Lang): string {
  return lang === 'zh' ? WEEKLY_FAIL_ZH : WEEKLY_FAIL_EN;
}
