import type { AssistantWeeklyReportJson } from './aiCareAssistant';

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
  try {
    const raw = localStorage.getItem(storageKey(catId, weekEnd));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedWeeklyReport;
    if (!parsed?.report || parsed.catId !== catId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveWeeklyReport(catId: string, weekEnd: string, report: AssistantWeeklyReportJson): void {
  const payload: SavedWeeklyReport = {
    catId,
    weekEnd,
    savedAt: new Date().toISOString(),
    report,
  };
  localStorage.setItem(storageKey(catId, weekEnd), JSON.stringify(payload));
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
  lines.push(report.weekSummary.trim());
  lines.push('');
  lines.push(zh ? '■ 照護完成度' : '■ Logging completion');
  lines.push(report.completionRate.trim());
  lines.push('');
  lines.push(zh ? '■ 趨勢' : '■ Trends');
  lines.push(report.trends.trim());
  lines.push('');
  lines.push(zh ? '■ 異常時間線' : '■ Abnormal timeline');
  lines.push(report.abnormalTimeline.trim());
  lines.push('');
  lines.push(zh ? '■ 體重變化' : '■ Weight');
  lines.push(report.weightChange.trim());
  lines.push('');
  lines.push(zh ? '■ 與上週比較' : '■ vs last week');
  lines.push(report.vsLastWeek.trim());
  lines.push('');
  lines.push(zh ? '■ 下週照護重點' : '■ Next week focus');
  lines.push(report.nextWeekFocus.trim());
  lines.push('');
  lines.push(
    zh
      ? '（照護觀察與提醒，非診斷或治療依據。）'
      : '(Care observations only — not diagnosis or treatment.)'
  );
  return lines.join('\n');
}
