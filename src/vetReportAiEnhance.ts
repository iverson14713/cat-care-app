/**
 * Professional vet-report AI copy: synthesize from structured logs when model output is weak.
 */

import {
  buildStructuredCareEventLines,
  describeWeightTrendForAi,
  type WeightPointInput,
} from './aiRecordNarrative';
import type { Lang } from './aiCareAssistant';
import type { VetReportAiSummary, VetReportPayload } from './vetReportData';
import { loadDailyRecord } from './vetReportData';
import type { DailyData } from './aiCareAssistant';

export type VetReportSignals = {
  vomiting: boolean;
  diarrhea: boolean;
  appetite: boolean;
  energy: boolean;
  hasAbnormalNotes: boolean;
  eventCount: number;
  datedFacts: string[];
  weightSummary: string;
};

const WEAK_PATTERNS_ZH = [
  '無法整理',
  '目前無法',
  '資料不足',
  '（無）',
  '9kg 減少至 9kg',
  '減少至',
  '增加至',
];
const WEAK_PATTERNS_EN = ['could not summarize', 'unable to summarize', 'insufficient data', 'N/A'];

function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (cur <= last) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out.reverse();
}

function formatShortDate(date: string, lang: Lang): string {
  const [, m, d] = date.split('-');
  return lang === 'zh' ? `${Number(m)}/${Number(d)}` : `${Number(m)}/${Number(d)}`;
}

export function extractVetReportSignals(
  payload: VetReportPayload,
  lang: Lang,
  petType: 'cat' | 'dog' = 'cat'
): VetReportSignals {
  const dayRows = datesBetween(payload.startDate, payload.endDate).map((date) => ({
    date,
    data: loadDailyRecord(payload.cat.id, date) as DailyData,
  }));
  const events = buildStructuredCareEventLines(dayRows, lang, petType);
  const blob = [...events, ...payload.abnormalBullets, ...payload.timeline.flatMap((t) => t.lines)].join(' ');

  const vomiting =
    /嘔吐|呕吐|vomit/i.test(blob) || payload.abnormalBullets.some((b) => /嘔吐|vomit/i.test(b));
  const diarrhea =
    /拉肚子|軟便|腹瀉|稀便|diarr|loose stool|soft stool/i.test(blob) ||
    payload.abnormalBullets.some((b) => /軟便|腹瀉|拉肚子|diarr/i.test(b));
  const appetite =
    /食慾|不吃|吃得少|appetite|not eating|ate less/i.test(blob) ||
    payload.abnormalBullets.some((b) => /食慾|appetite/i.test(b));
  const energy =
    /精神|無力|嗜睡|letharg|low energy|inactive/i.test(blob) ||
    payload.abnormalBullets.some((b) => /精神|energy/i.test(b));

  const datedFacts: string[] = [];
  for (const row of payload.timeline) {
    for (const line of row.lines) {
      datedFacts.push(`${formatShortDate(row.date, lang)}：${line}`);
    }
  }

  const weights: WeightPointInput[] = payload.weights.map((w) => ({
    date: w.date,
    weight: w.weight,
    note: w.note,
  }));

  return {
    vomiting,
    diarrhea,
    appetite,
    energy,
    hasAbnormalNotes: events.length > 0 || payload.abnormalBullets.length > 0,
    eventCount: events.length,
    datedFacts: datedFacts.slice(0, 12),
    weightSummary: describeWeightTrendForAi(weights, lang),
  };
}

export function isWeakVetAiField(text: string, lang: Lang): boolean {
  const t = text.trim();
  if (!t || t === '—' || t === '-') return true;
  const patterns = lang === 'zh' ? WEAK_PATTERNS_ZH : WEAK_PATTERNS_EN;
  if (patterns.some((p) => t.includes(p))) return true;
  if (/^\d{4}-\d{2}-\d{2}：/.test(t) && t.length < 40) return true;
  if (/^\d{1,2}\/\d{1,2}：/.test(t) && t.length < 40) return true;
  return false;
}

/** Rule-based professional summary when the model under-delivers. */
export function synthesizeVetReportSummary(signals: VetReportSignals, lang: Lang): VetReportAiSummary {
  const zh = lang === 'zh';
  const parts: string[] = [];

  if (signals.vomiting) parts.push(zh ? '嘔吐' : 'vomiting');
  if (signals.diarrhea) parts.push(zh ? '軟便／腹瀉' : 'soft stool/diarrhea');
  if (signals.appetite) parts.push(zh ? '食慾變化' : 'appetite changes');
  if (signals.energy) parts.push(zh ? '精神或活動力變化' : 'energy/activity changes');

  const hasConcern = parts.length > 0 || signals.hasAbnormalNotes;

  let watchItems: string;
  if (!hasConcern) {
    watchItems = zh
      ? '此期間照護紀錄未見明顯異常關鍵字，建議維持日常記錄習慣，方便日後比較。'
      : 'No clear abnormal keywords in this period — keep logging daily for future comparison.';
  } else if (parts.length >= 2) {
    watchItems = zh
      ? `近期紀錄出現${parts.slice(0, 2).join('與')}等狀況，雖未必代表持續惡化，但建議持續觀察排便型態、食慾與活動力；若症狀反覆或超過 1～2 天未改善，建議諮詢獸醫。`
      : `Recent logs mention ${parts.slice(0, 2).join(' and ')}. Keep watching stool, appetite, and energy; contact your vet if symptoms repeat or do not improve within 1–2 days.`;
  } else {
    watchItems = zh
      ? `近期紀錄出現${parts[0] ?? '異常'}相關描述，建議持續觀察整體精神、飲食與排泄；若症狀加重請及早諮詢獸醫。`
      : `Recent logs suggest ${parts[0] ?? 'abnormal'} cues — monitor energy, eating, and elimination; see your vet if things worsen.`;
  }

  const observeDirections = zh
    ? '可持續記錄每日進食量、喝水量與排便情況（形狀、次數）。留意是否再次嘔吐、腹瀉、拒食或精神不佳。若食慾明顯變差、連續嘔吐或血便，建議進一步就醫評估。'
    : 'Keep logging daily food and water intake and stool quality/frequency. Watch for repeat vomiting, diarrhea, refusal to eat, or low energy. Seek veterinary care for repeated vomiting, bloody stool, or poor appetite.';

  const factLines = signals.datedFacts.slice(0, 4).join(zh ? '；' : '; ');
  const vetHandoff = zh
    ? `${factLines ? `${factLines}。` : ''}${signals.weightSummary}`
    : `${factLines ? `${factLines}. ` : ''}${signals.weightSummary}`;

  return {
    watchItems,
    observeDirections,
    vetHandoff: vetHandoff.trim() || (zh ? '請依時間線向獸醫說明最近照護紀錄。' : 'Use the timeline when speaking with your vet.'),
  };
}

function pickField(
  aiVal: string,
  synthVal: string,
  lang: Lang,
  forceWhenConcern = false,
  hasConcern = false
): string {
  if (forceWhenConcern && hasConcern && isWeakVetAiField(aiVal, lang)) return synthVal;
  if (isWeakVetAiField(aiVal, lang)) return synthVal;
  return aiVal;
}

export function mergeVetReportSummary(
  ai: VetReportAiSummary,
  payload: VetReportPayload,
  lang: Lang,
  petType: 'cat' | 'dog' = 'cat'
): VetReportAiSummary {
  const signals = extractVetReportSignals(payload, lang, petType);
  const synthesized = synthesizeVetReportSummary(signals, lang);
  const hasConcern =
    signals.vomiting ||
    signals.diarrhea ||
    signals.appetite ||
    signals.energy ||
    signals.hasAbnormalNotes ||
    signals.eventCount > 0;

  return {
    watchItems: pickField(ai.watchItems, synthesized.watchItems, lang, true, hasConcern),
    observeDirections: pickField(ai.observeDirections, synthesized.observeDirections, lang),
    vetHandoff: pickField(ai.vetHandoff, synthesized.vetHandoff, lang) || synthesized.vetHandoff,
  };
}
