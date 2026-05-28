/**
 * Turn daily JSON + notes into dated, human-readable lines for LLM context.
 * Avoids opaque `poop=1` / `vomit=true` style payloads.
 */

import type { DailyData, Lang } from './aiCareAssistant';
import type { PetType } from './petTypes';
import { getDailyItemsForPetType } from './petTypes';

export type DayRecordInput = { date: string; data: DailyData };

export type WeightPointInput = { date: string; weight: number; note?: string };

type SignalRule = {
  zh: string[];
  en: string[];
  labelZh: string;
  labelEn: string;
};

const NOTE_SIGNAL_RULES: SignalRule[] = [
  { zh: ['吐', '嘔', '反芻'], en: ['vomit', 'threw up', 'regurg'], labelZh: '嘔吐', labelEn: 'Vomiting' },
  {
    zh: ['拉肚子', '腹瀉', '軟便', '稀便', '水便', '便血', '血便'],
    en: ['diarr', 'loose stool', 'soft stool', 'bloody stool', 'blood in stool'],
    labelZh: '拉肚子／軟便',
    labelEn: 'Diarrhea / soft stool',
  },
  {
    zh: ['不吃', '食慾差', '吃得少', '厭食', '拒食'],
    en: ['not eating', 'ate less', 'loss of appetite', 'poor appetite', 'refused food'],
    labelZh: '食慾下降',
    labelEn: 'Lower appetite',
  },
  {
    zh: ['喝水少', '喝水多', '飲水', '脫水'],
    en: ['drink less', 'drink more', 'water intake', 'dehydrat'],
    labelZh: '飲水變化',
    labelEn: 'Water intake change',
  },
  {
    zh: ['沒精神', '無精打采', '嗜睡', '無力', '躲起來', '發抖'],
    en: ['letharg', 'low energy', 'weak', 'hiding', 'tired', 'shaking'],
    labelZh: '精神／活動變差',
    labelEn: 'Lower energy / activity',
  },
  { zh: ['咳', '噴嚏', '呼吸'], en: ['cough', 'sneeze', 'breath'], labelZh: '咳嗽／呼吸', labelEn: 'Cough / breathing' },
];

function strField(data: DailyData, key: string): string {
  const v = data[key];
  return typeof v === 'string' ? v.trim() : '';
}

function noteBlob(data: DailyData): string {
  return [strField(data, 'abnormalNote'), strField(data, 'dailyNote')].filter(Boolean).join(' ');
}

function matchNoteSignals(note: string, lang: Lang): string[] {
  if (!note.trim()) return [];
  const blob = note.toLowerCase();
  const out: string[] = [];
  for (const rule of NOTE_SIGNAL_RULES) {
    const keys = lang === 'zh' ? rule.zh : rule.en;
    if (keys.some((k) => blob.includes(k.toLowerCase()) || note.includes(k))) {
      out.push(lang === 'zh' ? rule.labelZh : rule.labelEn);
    }
  }
  return out;
}

function feedingSummary(data: DailyData, lang: Lang): string | null {
  const morning = data.feedMorning === true;
  const night = data.feedNight === true;
  if (!morning && !night) {
    return lang === 'zh' ? '早晚餵食皆未勾選' : 'Neither morning nor evening feeding logged';
  }
  if (!morning) return lang === 'zh' ? '早上餵食未勾選' : 'Morning feeding not logged';
  if (!night) return lang === 'zh' ? '晚上餵食未勾選' : 'Evening feeding not logged';
  return null;
}

function eliminationSummary(data: DailyData, lang: Lang): string | null {
  const pee = data.pee === true;
  const poop = data.poop === true;
  if (!pee && !poop) {
    return lang === 'zh' ? '排尿與排便皆未勾選' : 'Neither pee nor poop logged';
  }
  if (!pee) return lang === 'zh' ? '今日排尿未勾選' : 'Pee not logged today';
  if (!poop) return lang === 'zh' ? '今日排便未勾選' : 'Poop not logged today';
  return null;
}

/** One day's human-readable care + abnormal signals. */
export function describeDayCareEvents(
  date: string,
  data: DailyData,
  lang: Lang,
  petType: PetType
): string[] {
  const zh = lang === 'zh';
  const events: string[] = [];
  const abnormalNote = strField(data, 'abnormalNote');
  const dailyNote = strField(data, 'dailyNote');

  const signals = matchNoteSignals(noteBlob(data), lang);
  for (const sig of signals) {
    events.push(
      zh
        ? `${date}：出現${sig}${abnormalNote ? `（異常備註：${abnormalNote.slice(0, 120)}）` : ''}`
        : `${date}: ${sig} noted${abnormalNote ? ` (abnormal note: ${abnormalNote.slice(0, 120)})` : ''}`
    );
  }

  if (abnormalNote && signals.length === 0) {
    events.push(zh ? `${date}：異常備註—${abnormalNote}` : `${date}: Abnormal note — ${abnormalNote}`);
  } else if (abnormalNote && signals.length > 0 && !events.some((e) => e.includes(abnormalNote.slice(0, 20)))) {
    events.push(zh ? `${date}：異常備註補充—${abnormalNote}` : `${date}: Additional abnormal note — ${abnormalNote}`);
  }

  if (dailyNote && !abnormalNote) {
    const dailySignals = matchNoteSignals(dailyNote, lang);
    if (dailySignals.length > 0) {
      for (const sig of dailySignals) {
        events.push(zh ? `${date}：${sig}（今日備註）` : `${date}: ${sig} (daily note)`);
      }
    }
  }

  const feedGap = feedingSummary(data, lang);
  if (feedGap && (signals.length > 0 || abnormalNote)) {
    events.push(zh ? `${date}：${feedGap}` : `${date}: ${feedGap}`);
  }

  const elimGap = eliminationSummary(data, lang);
  if (elimGap && (signals.length > 0 || abnormalNote)) {
    events.push(zh ? `${date}：${elimGap}` : `${date}: ${elimGap}`);
  }

  const photoAbn = Array.isArray(data.abnormalPhotos)
    ? data.abnormalPhotos.filter((x): x is string => typeof x === 'string' && x.length > 0).length
    : 0;
  if (photoAbn > 0 && (signals.length > 0 || abnormalNote)) {
    events.push(
      zh ? `${date}：附有 ${photoAbn} 張異常照片` : `${date}: ${photoAbn} abnormal photo(s) attached`
    );
  }

  if (events.length === 0) {
    const labels = getDailyItemsForPetType(petType);
    const checked = labels
      .filter((item) => data[item.id] === true)
      .map((item) => item.id)
      .slice(0, 6);
    if (checked.length > 0 || dailyNote) {
      const bits = labels
        .map((item) => {
          const on = data[item.id] === true;
          return on ? item.id : null;
        })
        .filter(Boolean);
      if (bits.length > 0 && !abnormalNote && signals.length === 0) {
        // routine-only day — omit from abnormal event list
      }
    }
  }

  return events;
}

export function buildStructuredCareEventLines(
  days: DayRecordInput[],
  lang: Lang,
  petType: PetType
): string[] {
  const events: string[] = [];
  for (const day of days) {
    events.push(...describeDayCareEvents(day.date, day.data, lang, petType));
  }
  return events;
}

export const WEIGHT_STABLE_THRESHOLD_KG = 0.1;

export function buildWeightNarrativeLines(
  weights: WeightPointInput[],
  lang: Lang
): string[] {
  const sorted = weights
    .filter((w) => w.date && Number.isFinite(w.weight) && w.weight > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  const lines: string[] = [];
  const zh = lang === 'zh';
  for (let i = 0; i < sorted.length; i++) {
    const w = sorted[i];
    const prev = sorted[i + 1];
    let delta = '';
    if (prev && prev.date !== w.date) {
      const d = Math.round((w.weight - prev.weight) * 100) / 100;
      if (Math.abs(d) >= WEIGHT_STABLE_THRESHOLD_KG) {
        delta = zh ? `（較前次 ${d > 0 ? '+' : ''}${d} kg）` : ` (vs prior ${d > 0 ? '+' : ''}${d} kg)`;
      } else {
        delta = zh ? '（與前次相近）' : ' (similar to prior)';
      }
    }
    const note = w.note?.trim();
    lines.push(
      zh
        ? `${w.date}：體重 ${w.weight} kg${delta}${note ? `，備註：${note}` : ''}`
        : `${w.date}: weight ${w.weight} kg${delta}${note ? `, note: ${note}` : ''}`
    );
  }
  return lines;
}

/** One paragraph for AI: stable if range < 0.1 kg. */
export function describeWeightTrendForAi(weights: WeightPointInput[], lang: Lang): string {
  const sorted = weights
    .filter((w) => w.date && Number.isFinite(w.weight) && w.weight > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const zh = lang === 'zh';
  if (sorted.length === 0) {
    return zh ? '此期間無體重紀錄。' : 'No weight entries in this period.';
  }
  if (sorted.length === 1) {
    return zh
      ? `最近一筆體重為 ${sorted[0].weight} kg（${sorted[0].date}），建議持續記錄以觀察趨勢。`
      : `Latest weight is ${sorted[0].weight} kg (${sorted[0].date}); keep logging to see a trend.`;
  }
  const minW = Math.min(...sorted.map((s) => s.weight));
  const maxW = Math.max(...sorted.map((s) => s.weight));
  const range = Math.round((maxW - minW) * 100) / 100;
  const fmt = (d: string) => {
    const [, m, day] = d.split('-');
    return `${Number(m)}/${Number(day)}`;
  };
  if (range < WEIGHT_STABLE_THRESHOLD_KG) {
    return zh
      ? `近期體重約落在 ${minW}～${maxW} kg 間（${fmt(sorted[0].date)}～${fmt(sorted[sorted.length - 1].date)}），整體變化不大。`
      : `Weight stayed about ${minW}–${maxW} kg (${fmt(sorted[0].date)}–${fmt(sorted[sorted.length - 1].date)}); little change overall.`;
  }
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const delta = Math.round((last.weight - first.weight) * 100) / 100;
  const dir =
    delta > 0
      ? zh
        ? '略為上升'
        : 'slightly increased'
      : zh
        ? '略為下降'
        : 'slightly decreased';
  return zh
    ? `體重由 ${first.weight} kg（${fmt(first.date)}）變為 ${last.weight} kg（${fmt(last.date)}），${dir}約 ${Math.abs(delta)} kg，請搭配精神與食慾一起觀察。`
    : `Weight went from ${first.weight} kg (${fmt(first.date)}) to ${last.weight} kg (${fmt(last.date)}), ${dir} by about ${Math.abs(delta)} kg — interpret together with appetite and energy.`;
}

export function formatDayCareChecklistLine(
  date: string,
  data: DailyData,
  lang: Lang,
  petType: PetType
): string {
  const zh = lang === 'zh';
  const labels = getDailyItemsForPetType(petType);
  const labelMap: Record<Lang, Record<string, string>> = {
    zh: {
      feedMorning: '早上餵食',
      feedNight: '晚上餵食',
      litterMorning: '早上清貓砂',
      litterNight: '晚上清貓砂',
      walkMorning: '早上散步',
      walkNight: '晚上散步',
      pee: '排尿',
      poop: '排便',
      waterCan: '飲水／罐頭',
      snack: '點心',
      brushHair: '梳毛',
      brushTeeth: '刷牙',
    },
    en: {
      feedMorning: 'AM feed',
      feedNight: 'PM feed',
      litterMorning: 'AM litter',
      litterNight: 'PM litter',
      walkMorning: 'AM walk',
      walkNight: 'PM walk',
      pee: 'Pee',
      poop: 'Poop',
      snack: 'Snack',
      waterCan: 'Water/wet food',
      brushHair: 'Brush',
      brushTeeth: 'Teeth',
    },
  };
  const parts = labels.map((item) => {
    const label = labelMap[lang][item.id] ?? item.id;
    const val = data[item.id] === true ? (zh ? '是' : 'yes') : zh ? '否' : 'no';
    return `${label}=${val}`;
  });
  const an = strField(data, 'abnormalNote');
  const dn = strField(data, 'dailyNote');
  return `${date}：${parts.join('、')} | ${zh ? '異常備註' : 'abnormal'}="${an || '—'}" | ${zh ? '備註' : 'note'}="${dn || '—'}"`;
}

export function recordContextHasCareSignals(recordContext: string): boolean {
  const m = recordContext.match(/結構化照護事件（共 (\d+) 則/);
  if (m && Number(m[1]) > 0) return true;
  const m2 = recordContext.match(/Structured care events \((\d+) total\)/i);
  if (m2 && Number(m2[1]) > 0) return true;
  return false;
}
