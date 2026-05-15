import { getAiPlan } from './aiClient';

const VET_AI_USAGE_PREFIX = 'vet-report-ai-usage-';

export function getVetAiDailyLimit(plan?: 'free' | 'pro'): number {
  const p = plan ?? getAiPlan();
  return p === 'pro' ? Number.POSITIVE_INFINITY : 1;
}

function vetAiUsageKey(usageDate: string): string {
  return `${VET_AI_USAGE_PREFIX}${usageDate}`;
}

export function peekVetAiUsedToday(usageDate: string): number {
  try {
    const n = Number(localStorage.getItem(vetAiUsageKey(usageDate)));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function recordVetAiUsedToday(usageDate: string): void {
  try {
    const used = peekVetAiUsedToday(usageDate) + 1;
    localStorage.setItem(vetAiUsageKey(usageDate), String(used));
  } catch {
    // ignore
  }
}

export function canUseVetAiSummary(usageDate: string, plan?: 'free' | 'pro'): boolean {
  const limit = getVetAiDailyLimit(plan);
  if (!Number.isFinite(limit)) return true;
  return peekVetAiUsedToday(usageDate) < limit;
}

export function canExportVetPdf(plan?: 'free' | 'pro'): boolean {
  return (plan ?? getAiPlan()) === 'pro';
}

export function maxVetReportDays(plan?: 'free' | 'pro'): number {
  return (plan ?? getAiPlan()) === 'pro' ? 365 : 7;
}
