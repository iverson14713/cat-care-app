import type { VetReportAiSummary } from './vetReportData';

export class VetReportApiError extends Error {
  readonly code?: string;
  readonly httpStatus?: number;

  constructor(message: string, code?: string, httpStatus?: number) {
    super(message);
    this.name = 'VetReportApiError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

const UNAVAILABLE_ZH = 'AI 重點整理暫時無法使用，請稍後再試。';
const UNAVAILABLE_EN = 'AI summary is temporarily unavailable. Please try again later.';

/** Map raw HTTP / Vercel errors to user-facing copy (never show NOT_FOUND HTML). */
export function friendlyVetReportAiError(
  raw: string,
  lang: 'zh' | 'en',
  httpStatus?: number
): string {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const routeMissing =
    httpStatus === 404 ||
    lower.includes('not_found') ||
    lower.includes('could not be found') ||
    lower.includes('page could not be found');
  const serverDown =
    httpStatus === 502 ||
    httpStatus === 503 ||
    httpStatus === 500 ||
    httpStatus === 405;
  if (routeMissing || serverDown || !text || text.length > 200) {
    return lang === 'zh' ? UNAVAILABLE_ZH : UNAVAILABLE_EN;
  }
  return text;
}

function parseAiSummary(data: Record<string, unknown>): VetReportAiSummary | null {
  const watchItems = typeof data.watchItems === 'string' ? data.watchItems.trim() : '';
  const observeDirections =
    typeof data.observeDirections === 'string' ? data.observeDirections.trim() : '';
  const vetHandoff = typeof data.vetHandoff === 'string' ? data.vetHandoff.trim() : '';
  if (!watchItems && !observeDirections && !vetHandoff) return null;
  return {
    watchItems: watchItems || '—',
    observeDirections: observeDirections || '—',
    vetHandoff: vetHandoff || '—',
  };
}

export async function generateVetReportAiSummary(
  lang: 'zh' | 'en',
  recordContext: string,
  meta: { clientId: string; catId: string; usageDate: string; plan: 'free' | 'pro' },
  signal?: AbortSignal
): Promise<VetReportAiSummary> {
  const res = await fetch('/api/assistant/vet-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lang,
      recordContext,
      clientId: meta.clientId,
      catId: meta.catId,
      usageDate: meta.usageDate,
      plan: meta.plan,
    }),
    signal,
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // ignore
  }
  if (!res.ok) {
    const raw =
      typeof data.error === 'string' ? data.error : text.trim() || res.statusText || `HTTP ${res.status}`;
    const code = typeof data.code === 'string' ? data.code : undefined;
    const msg = friendlyVetReportAiError(raw, lang, res.status);
    throw new VetReportApiError(msg, code, res.status);
  }
  const summary = parseAiSummary(data);
  if (!summary) throw new VetReportApiError('Invalid AI response', 'OPENAI', res.status);
  return summary;
}
