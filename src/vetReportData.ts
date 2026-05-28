/** Build vet handoff report from localStorage only (no Supabase daily_records). */

import {
  buildStructuredCareEventLines,
  buildWeightNarrativeLines,
  describeWeightTrendForAi,
  formatDayCareChecklistLine,
} from './aiRecordNarrative';
import type { DailyData, Lang } from './aiCareAssistant';
import { loadReminders, type Reminder } from './reminders';
import { safeLoadJson } from './safeStorage';
import { dailyStorageKey, weightStorageKey } from './userStorageScope';
import { normalizePetType } from './petTypes';

export type VetReportCatProfile = {
  id: string;
  name: string;
  emoji: string;
  birthday: string;
  gender: string;
  breed: string;
  chronicNote: string;
  allergyNote: string;
  vetClinic: string;
  profileNote: string;
};

export type VetReportDatePreset = '7d' | '30d' | 'custom';

export type VetReportSections = {
  abnormal: boolean;
  weight: boolean;
  photos: boolean;
  notes: boolean;
  ai: boolean;
};

export type VetReportTimelineEntry = {
  date: string;
  lines: string[];
};

export type VetReportPhotoGroup = {
  date: string;
  abnormalPhotos: string[];
  dailyPhotos: string[];
};

export type VetReportWeightPoint = {
  date: string;
  weight: number;
  note: string;
};

export type VetReportAiSummary = {
  watchItems: string;
  observeDirections: string;
  vetHandoff: string;
};

export type VetReportPayload = {
  cat: VetReportCatProfile;
  startDate: string;
  endDate: string;
  abnormalBullets: string[];
  timeline: VetReportTimelineEntry[];
  weights: VetReportWeightPoint[];
  photos: VetReportPhotoGroup[];
  noteDays: { date: string; dailyNote: string }[];
};

function getPhotoList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((x) => typeof x === 'string' && x.length > 0);
  return [];
}

export function loadDailyRecord(catId: string, date: string): Record<string, unknown> {
  const key = dailyStorageKey(catId, date);
  const legacyKey = `cat-calendar-daily-${catId}-${date}`;
  let parsed = safeLoadJson<Record<string, unknown>>(key, {}, `vet daily ${date}`);
  if (Object.keys(parsed).length === 0) {
    parsed = safeLoadJson<Record<string, unknown>>(legacyKey, {}, `vet daily legacy ${date}`);
  }
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function loadWeightRecords(catId: string): VetReportWeightPoint[] {
  const key = weightStorageKey(catId);
  const legacyKey = `cat-calendar-weights-${catId}`;
  let parsed = safeLoadJson<unknown[]>(key, [], 'vet weights');
  if (!Array.isArray(parsed) || parsed.length === 0) {
    parsed = safeLoadJson<unknown[]>(legacyKey, [], 'vet weights legacy');
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item: { date?: string; weight?: number; note?: string }) => ({
      date: typeof item.date === 'string' ? item.date : '',
      weight: Number(item.weight),
      note: typeof item.note === 'string' ? item.note.trim() : '',
    }))
    .filter((w) => w.date && Number.isFinite(w.weight) && w.weight > 0);
}

export function formatDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function computeVetReportDateRange(
  preset: VetReportDatePreset,
  today: string,
  customStart: string,
  customEnd: string
): { start: string; end: string } {
  const end = today;
  if (preset === 'custom' && customStart && customEnd) {
    return customStart <= customEnd
      ? { start: customStart, end: customEnd }
      : { start: customEnd, end: customStart };
  }
  const d = new Date(`${today}T12:00:00`);
  if (preset === '30d') {
    d.setDate(d.getDate() - 29);
    return { start: formatDateLocal(d), end };
  }
  d.setDate(d.getDate() - 6);
  return { start: formatDateLocal(d), end };
}

export function clampRangeForFree(
  start: string,
  end: string,
  today: string,
  isPro: boolean
): { start: string; end: string; clamped: boolean } {
  if (isPro) return { start, end, clamped: false };
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - 29);
  const freeStart = formatDateLocal(d);
  if (start >= freeStart) return { start, end, clamped: false };
  return { start: freeStart, end, clamped: true };
}

function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (cur <= last) {
    out.push(formatDateLocal(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out.reverse();
}

function extractAbnormalThemes(notes: string[], lang: 'zh' | 'en'): string[] {
  const themes = new Set<string>();
  const rules: { zh: string[]; en: string[]; labelZh: string; labelEn: string }[] = [
    { zh: ['吐', '嘔'], en: ['vomit', 'throw'], labelZh: '嘔吐', labelEn: 'Vomiting' },
    { zh: ['軟便', '腹瀉', '拉肚子', '稀便'], en: ['diarr', 'loose', 'soft stool'], labelZh: '軟便 / 腹瀉', labelEn: 'Soft stool / diarrhea' },
    { zh: ['食慾', '不吃', '吃得少'], en: ['appetite', 'not eating', 'ate less'], labelZh: '食慾下降', labelEn: 'Lower appetite' },
    { zh: ['喝水', '飲水'], en: ['water', 'drink', 'hydration'], labelZh: '喝水 / 飲水變化', labelEn: 'Water intake change' },
    { zh: ['精神', '無力', '嗜睡'], en: ['letharg', 'energy', 'inactive'], labelZh: '精神 / 活動變化', labelEn: 'Energy / activity change' },
    { zh: ['咳', '噴嚏'], en: ['cough', 'sneeze'], labelZh: '咳嗽 / 打噴嚏', labelEn: 'Cough / sneezing' },
  ];
  const blob = notes.join(' ').toLowerCase();
  for (const r of rules) {
    const keys = lang === 'zh' ? r.zh : r.en;
    if (keys.some((k) => blob.includes(k.toLowerCase()))) {
      themes.add(lang === 'zh' ? r.labelZh : r.labelEn);
    }
  }
  return Array.from(themes);
}

export function buildVetReport(
  cat: VetReportCatProfile,
  startDate: string,
  endDate: string,
  sections: VetReportSections,
  lang: 'zh' | 'en' = 'zh'
): VetReportPayload {
  const dates = datesBetween(startDate, endDate);
  const timeline: VetReportTimelineEntry[] = [];
  const photos: VetReportPhotoGroup[] = [];
  const noteDays: { date: string; dailyNote: string }[] = [];
  const abnormalNotes: string[] = [];

  for (const date of dates) {
    const data = loadDailyRecord(cat.id, date);
    const abnormalNote =
      typeof data.abnormalNote === 'string' ? data.abnormalNote.trim() : '';
    const dailyNote = typeof data.dailyNote === 'string' ? data.dailyNote.trim() : '';
    const abnormalPhotos = sections.photos ? getPhotoList(data.abnormalPhotos) : [];
    const dailyPhotos = sections.photos ? getPhotoList(data.dailyPhotos) : [];

    const lines: string[] = [];
    if (sections.abnormal && abnormalNote) {
      abnormalNotes.push(abnormalNote);
      lines.push(abnormalNote);
    }
    if (sections.notes && dailyNote) {
      noteDays.push({ date, dailyNote });
      if (!abnormalNote) lines.push(dailyNote);
      else lines.push(dailyNote);
    }
    if (lines.length > 0) timeline.push({ date, lines });
    if (abnormalPhotos.length > 0 || dailyPhotos.length > 0) {
      photos.push({ date, abnormalPhotos, dailyPhotos });
    }
  }

  let weights: VetReportWeightPoint[] = [];
  if (sections.weight) {
    weights = loadWeightRecords(cat.id)
      .filter((w) => w.date >= startDate && w.date <= endDate)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  const themes = extractAbnormalThemes(abnormalNotes, lang);
  const abnormalBullets = sections.abnormal
    ? themes.length > 0
      ? themes
      : abnormalNotes.length > 0
        ? [lang === 'zh' ? '照護紀錄中有異常備註，詳見時間線' : 'Abnormal notes in logs — see timeline']
        : []
    : [];

  return {
    cat,
    startDate,
    endDate,
    abnormalBullets,
    timeline,
    weights,
    photos,
    noteDays,
  };
}

function loadDailyDaysInRange(
  catId: string,
  startDate: string,
  endDate: string
): { date: string; data: Record<string, unknown> }[] {
  return datesBetween(startDate, endDate).map((date) => ({
    date,
    data: loadDailyRecord(catId, date),
  }));
}

function formatReminderForAi(r: Reminder, lang: Lang): string {
  const zh = lang === 'zh';
  const repeat =
    r.repeatType === 'once'
      ? zh
        ? `單次 ${r.dueDate ?? ''}`
        : `once ${r.dueDate ?? ''}`
      : r.repeatType === 'weekly'
        ? zh
          ? `每週`
          : 'weekly'
        : r.repeatType === 'monthly'
          ? zh
            ? `每月`
            : 'monthly'
          : zh
            ? `每日`
            : 'daily';
  return `${r.title} @ ${r.time} (${repeat})${r.enabled ? '' : zh ? ' [已關閉]' : ' [off]'}`;
}

export function buildVetReportContextText(
  payload: VetReportPayload,
  sections: VetReportSections,
  lang: 'zh' | 'en',
  options?: { petType?: 'cat' | 'dog' }
): string {
  const zh = lang === 'zh';
  const petType = normalizePetType(options?.petType ?? 'cat');
  const dayRows = loadDailyDaysInRange(payload.cat.id, payload.startDate, payload.endDate);

  const structuredEvents = buildStructuredCareEventLines(dayRows, lang, petType);
  const weightLines =
    sections.weight && payload.weights.length
      ? buildWeightNarrativeLines(payload.weights, lang)
      : [];

  const lines: string[] = [];
  lines.push(zh ? '--- 寵物與報告範圍 ---' : '--- Pet & report range ---');
  lines.push(`${zh ? '名稱' : 'Name'}: ${payload.cat.name}`);
  lines.push(`${zh ? '日期' : 'Range'}: ${payload.startDate} — ${payload.endDate}`);
  lines.push(`${zh ? '慢性病' : 'Chronic'}: ${payload.cat.chronicNote || '—'}`);
  lines.push(`${zh ? '過敏' : 'Allergy'}: ${payload.cat.allergyNote || '—'}`);

  lines.push('');
  if (structuredEvents.length > 0) {
    lines.push(
      zh
        ? `--- 結構化照護事件（共 ${structuredEvents.length} 則；必須依此整理，不可回覆「無法整理」） ---`
        : `--- Structured care events (${structuredEvents.length} total; must use these — do not say "could not summarize") ---`
    );
    for (const e of structuredEvents) lines.push(e);
  } else {
    lines.push(
      zh
        ? '--- 結構化照護事件（共 0 則；此區間無明確異常關鍵字） ---'
        : '--- Structured care events (0 in range; no explicit abnormal keywords) ---'
    );
  }

  if (sections.abnormal && payload.abnormalBullets.length) {
    lines.push('');
    lines.push(zh ? '--- 異常主題摘要 ---' : '--- Abnormal theme summary ---');
    for (const b of payload.abnormalBullets) lines.push(`• ${b}`);
  }

  if (sections.abnormal && payload.timeline.length) {
    lines.push('');
    lines.push(zh ? '--- 異常／備註時間線 ---' : '--- Abnormal / notes timeline ---');
    for (const t of payload.timeline) {
      lines.push(`${t.date}: ${t.lines.join('；')}`);
    }
  }

  lines.push('');
  lines.push(
    zh
      ? `--- 每日照護勾選（${dayRows.length} 天；新→舊） ---`
      : `--- Daily care checklist (${dayRows.length} days; newest first) ---`
  );
  for (const row of dayRows) {
    lines.push(formatDayCareChecklistLine(row.date, row.data as DailyData, lang, petType));
  }

  if (weightLines.length) {
    lines.push('');
    lines.push(zh ? '--- 體重變化（新→舊） ---' : '--- Weight history (newest first) ---');
    for (const w of weightLines) lines.push(w);
    lines.push(zh ? '體重趨勢解讀：' : 'Weight trend interpretation: ');
    lines.push(describeWeightTrendForAi(payload.weights, lang));
  }

  const blob = [...payload.abnormalBullets, ...payload.timeline.flatMap((t) => t.lines)].join(' ');
  const signals = {
    vomiting: /嘔吐|呕吐|vomit/i.test(blob),
    diarrhea: /拉肚子|軟便|腹瀉|稀便|diarr|loose stool|soft stool/i.test(blob),
    appetite: /食慾|不吃|吃得少|appetite|not eating|ate less/i.test(blob),
    energy: /精神|無力|嗜睡|letharg|low energy|inactive/i.test(blob),
  };
  if (signals.vomiting || signals.diarrhea || signals.appetite || signals.energy) {
    lines.push('');
    lines.push(zh ? '--- 系統偵測重點（撰寫時必須涵蓋） ---' : '--- System-detected focus (must address) ---');
    if (signals.vomiting) lines.push(zh ? '• 嘔吐相關紀錄' : '• Vomiting mentioned');
    if (signals.diarrhea) lines.push(zh ? '• 軟便／腹瀉相關紀錄' : '• Diarrhea/soft stool mentioned');
    if (signals.appetite) lines.push(zh ? '• 食慾變化' : '• Appetite change');
    if (signals.energy) lines.push(zh ? '• 精神／活動變化' : '• Energy/activity change');
  }

  const reminders = loadReminders().filter((r) => r.catId === payload.cat.id && r.enabled);
  if (reminders.length) {
    lines.push('');
    lines.push(zh ? '--- 已啟用提醒 ---' : '--- Enabled reminders ---');
    for (const r of reminders.slice(0, 12)) {
      lines.push(formatReminderForAi(r, lang));
    }
  }

  if (sections.notes && payload.noteDays.length) {
    lines.push('');
    lines.push(zh ? '--- 一般今日備註 ---' : '--- General daily notes ---');
    for (const n of payload.noteDays) {
      lines.push(`${n.date}: ${n.dailyNote}`);
    }
  }

  const text = lines.join('\n');
  if (import.meta.env.DEV) {
    console.log('[AI vet-report] request payload (recordContext)', {
      chars: text.length,
      structuredEventCount: structuredEvents.length,
      preview: text.slice(0, 2000),
    });
  }
  return text;
}
