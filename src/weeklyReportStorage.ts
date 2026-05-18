import type { AssistantWeeklyReportJson } from './aiCareAssistant';
import { normalizeWeeklyReport, weeklySectionText, type Lang } from './weeklyReportModel';
import { safeLoadJson, safeSetItem, storageError } from './safeStorage';

export type SavedWeeklyReport = {
  catId: string;
  weekEnd: string;
  savedAt: string;
  report: AssistantWeeklyReportJson;
};

function storageKey(catId: string, weekEnd: string): string {
  return `weekly-ai-report-${catId}-${weekEnd}`;
}

export function loadSavedWeeklyReport(catId: string, weekEnd: string): SavedWeeklyReport | null {
  const key = storageKey(catId, weekEnd);
  try {
    const parsed = safeLoadJson<SavedWeeklyReport | null>(key, null, 'weekly report', localStorage);
    if (!parsed?.report || parsed.catId !== catId) return null;
    return {
      ...parsed,
      report: normalizeWeeklyReport(parsed.report),
    };
  } catch (err) {
    storageError('loadSavedWeeklyReport', err, key);
    return null;
  }
}

export function saveWeeklyReport(
  catId: string,
  weekEnd: string,
  report: AssistantWeeklyReportJson,
  lang: Lang = 'zh'
): void {
  const payload: SavedWeeklyReport = {
    catId,
    weekEnd,
    savedAt: new Date().toISOString(),
    report: normalizeWeeklyReport(report, lang),
  };
  const key = storageKey(catId, weekEnd);
  if (!safeSetItem(key, JSON.stringify(payload))) {
    storageError('saveWeeklyReport: write failed', new Error('quota or private mode'), key);
  }
}

export function formatWeeklyReportPlainText(
  report: AssistantWeeklyReportJson,
  meta: { catName: string; weekStart: string; weekEnd: string; lang: 'zh' | 'en' }
): string {
  const { catName, weekStart, weekEnd, lang } = meta;
  const zh = lang === 'zh';
  const lines: string[] = [];
  lines.push(zh ? `【AI 照護週報】${catName}` : `[AI weekly care report] ${catName}`);
  lines.push(`${weekStart} — ${weekEnd}`);
  lines.push('');
  lines.push(zh ? '■ 本週總結' : '■ This week');
  const safe = normalizeWeeklyReport(report, lang);
  lines.push(weeklySectionText(safe, 'weekSummary'));
  lines.push('');
  lines.push(zh ? '■ 照護完成度' : '■ Logging completion');
  lines.push(weeklySectionText(safe, 'completionRate'));
  lines.push('');
  lines.push(zh ? '■ 趨勢' : '■ Trends');
  lines.push(weeklySectionText(safe, 'trends'));
  lines.push('');
  lines.push(zh ? '■ 異常時間線' : '■ Abnormal timeline');
  lines.push(weeklySectionText(safe, 'abnormalTimeline'));
  lines.push('');
  lines.push(zh ? '■ 體重變化' : '■ Weight');
  lines.push(weeklySectionText(safe, 'weightChange'));
  lines.push('');
  lines.push(zh ? '■ 與上週比較' : '■ vs last week');
  lines.push(weeklySectionText(safe, 'vsLastWeek'));
  lines.push('');
  lines.push(zh ? '■ 下週照護重點' : '■ Next week focus');
  lines.push(weeklySectionText(safe, 'nextWeekFocus'));
  lines.push('');
  lines.push(
    zh
      ? '（照護觀察與提醒，非診斷或治療依據。）'
      : '(Care observations only — not diagnosis or treatment.)'
  );
  return lines.join('\n');
}
