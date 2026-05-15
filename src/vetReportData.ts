/** Build vet handoff report from localStorage only (no Supabase daily_records). */

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

function loadDailyRecord(catId: string, date: string): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(`cat-calendar-daily-${catId}-${date}`);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function loadWeightRecords(catId: string): VetReportWeightPoint[] {
  try {
    const raw = localStorage.getItem(`cat-calendar-weights-${catId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item: { date?: string; weight?: number; note?: string }) => ({
        date: typeof item.date === 'string' ? item.date : '',
        weight: Number(item.weight),
        note: typeof item.note === 'string' ? item.note.trim() : '',
      }))
      .filter((w) => w.date && Number.isFinite(w.weight) && w.weight > 0);
  } catch {
    return [];
  }
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
  d.setDate(d.getDate() - 6);
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

export function buildVetReportContextText(
  payload: VetReportPayload,
  sections: VetReportSections,
  lang: 'zh' | 'en'
): string {
  const lines: string[] = [];
  lines.push(`Cat: ${payload.cat.name}`);
  lines.push(`Range: ${payload.startDate} — ${payload.endDate}`);
  lines.push(`Chronic: ${payload.cat.chronicNote || '-'}`);
  lines.push(`Allergy: ${payload.cat.allergyNote || '-'}`);
  if (sections.abnormal) {
    lines.push('--- Abnormal themes / notes ---');
    for (const t of payload.timeline) {
      lines.push(`${t.date}: ${t.lines.join('; ')}`);
    }
  }
  if (sections.weight && payload.weights.length) {
    lines.push('--- Weight ---');
    for (const w of payload.weights) {
      lines.push(`${w.date}: ${w.weight} kg ${w.note ? `| ${w.note}` : ''}`);
    }
  }
  if (sections.notes && payload.noteDays.length) {
    lines.push('--- Daily notes ---');
    for (const n of payload.noteDays) {
      lines.push(`${n.date}: ${n.dailyNote}`);
    }
  }
  return lines.join('\n');
}
