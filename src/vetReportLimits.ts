import { getAiPlan } from './aiClient';

export function canExportVetPdf(plan?: 'free' | 'pro'): boolean {
  return (plan ?? getAiPlan()) === 'pro';
}

export function maxVetReportDays(plan?: 'free' | 'pro'): number {
  return (plan ?? getAiPlan()) === 'pro' ? 365 : 30;
}
