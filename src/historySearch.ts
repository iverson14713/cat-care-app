export type HistoryFilterChip = 'all' | 'abnormal' | 'photo' | 'note' | 'weight';

export type HistoryHitTag = 'abnormal' | 'photo' | 'note' | 'weight';

export type HistoryDatePreset = 'none' | '7d' | '30d' | 'month';

export type HistorySearchHit = {
  date: string;
  snippet: string;
  tags: HistoryHitTag[];
};

export type DailyHistoryRow = { date: string; data: Record<string, unknown> };

export type WeightHistoryRow = { date: string; weight: number; note: string };

export type HistorySearchInput = {
  catName: string;
  dailyRows: DailyHistoryRow[];
  weightRows: WeightHistoryRow[];
  filter: HistoryFilterChip;
  keyword: string;
  dateStart: string;
  dateEnd: string;
};

function getPhotoList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string');
  return [];
}

function strField(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  return typeof v === 'string' ? v.trim() : '';
}

function clipSnippet(s: string, max = 120): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return '—';
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function inDateRange(date: string, start: string, end: string): boolean {
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function textMatches(text: string, kw: string): boolean {
  if (!kw) return false;
  return text.toLowerCase().includes(kw.toLowerCase());
}

function rowFlags(data: Record<string, unknown> | null, weight: WeightHistoryRow | undefined) {
  const abnormalNote = data ? strField(data, 'abnormalNote') : '';
  const dailyNote = data ? strField(data, 'dailyNote') : '';
  const abnormalPhotos = data ? getPhotoList(data.abnormalPhotos) : [];
  const dailyPhotos = data ? getPhotoList(data.dailyPhotos) : [];
  const hasAbnormal = abnormalNote.length > 0 || abnormalPhotos.length > 0;
  const hasPhoto = abnormalPhotos.length > 0 || dailyPhotos.length > 0;
  const hasNote = abnormalNote.length > 0 || dailyNote.length > 0;
  const hasWeight = Boolean(weight);
  return { abnormalNote, dailyNote, abnormalPhotos, dailyPhotos, hasAbnormal, hasPhoto, hasNote, hasWeight };
}

function passesChip(
  chip: HistoryFilterChip,
  flags: ReturnType<typeof rowFlags>
): boolean {
  switch (chip) {
    case 'all':
      return true;
    case 'abnormal':
      return flags.hasAbnormal;
    case 'photo':
      return flags.hasPhoto;
    case 'note':
      return flags.hasNote;
    case 'weight':
      return flags.hasWeight;
    default:
      return true;
  }
}

/** True when UI should show compact search results instead of full day cards. */
export function isHistorySearchModeActive(input: {
  filter: HistoryFilterChip;
  keyword: string;
  dateStart: string;
  dateEnd: string;
}): boolean {
  if (input.filter !== 'all') return true;
  if (input.keyword.trim().length > 0) return true;
  if (input.dateStart.trim() || input.dateEnd.trim()) return true;
  return false;
}

export function computeHistoryDateRange(
  preset: HistoryDatePreset,
  today: string
): { start: string; end: string } {
  if (preset === 'none') return { start: '', end: '' };
  const end = today;
  const d = new Date(`${today}T12:00:00`);
  if (preset === '7d') {
    d.setDate(d.getDate() - 6);
    return { start: formatYmd(d), end };
  }
  if (preset === '30d') {
    d.setDate(d.getDate() - 29);
    return { start: formatYmd(d), end };
  }
  return { start: `${today.slice(0, 7)}-01`, end };
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function searchHistory(input: HistorySearchInput): HistorySearchHit[] {
  const kw = input.keyword.trim();
  const nameMatches = kw.length > 0 && textMatches(input.catName, kw);

  const dailyByDate = new Map<string, Record<string, unknown>>();
  for (const row of input.dailyRows) dailyByDate.set(row.date, row.data);

  const weightByDate = new Map<string, WeightHistoryRow>();
  for (const w of input.weightRows) weightByDate.set(w.date, w);

  const allDates = new Set<string>([...dailyByDate.keys(), ...weightByDate.keys()]);
  const hits: HistorySearchHit[] = [];

  for (const date of Array.from(allDates).sort((a, b) => b.localeCompare(a))) {
    if (!inDateRange(date, input.dateStart, input.dateEnd)) continue;

    const data = dailyByDate.get(date) ?? null;
    const weight = weightByDate.get(date);
    const flags = rowFlags(data, weight);

    if (!passesChip(input.filter, flags)) continue;

    const tags: HistoryHitTag[] = [];
    const snippetParts: string[] = [];
    let fieldMatched = false;

    if (flags.hasAbnormal) tags.push('abnormal');
    if (flags.hasPhoto) tags.push('photo');
    if (flags.hasNote) tags.push('note');
    if (flags.hasWeight) tags.push('weight');

    if (flags.abnormalNote && (!kw || textMatches(flags.abnormalNote, kw) || nameMatches)) {
      fieldMatched = true;
      snippetParts.push(flags.abnormalNote);
    }
    if (flags.dailyNote && (!kw || textMatches(flags.dailyNote, kw) || nameMatches)) {
      fieldMatched = true;
      snippetParts.push(flags.dailyNote);
    }
    if (weight) {
      const wLine = weight.note.trim()
        ? `${weight.weight} kg — ${weight.note.trim()}`
        : `${weight.weight} kg`;
      if (!kw || textMatches(weight.note, kw) || textMatches(String(weight.weight), kw) || nameMatches) {
        fieldMatched = true;
        snippetParts.push(wLine);
      }
    }
    if (flags.hasPhoto && !kw) {
      const n = flags.abnormalPhotos.length + flags.dailyPhotos.length;
      snippetParts.push(`×${n}`);
    }

    if (kw && !nameMatches && !fieldMatched) continue;

    if (nameMatches && snippetParts.length === 0) {
      snippetParts.push(input.catName);
    }

    const uniqueTags = Array.from(new Set(tags));
    if (uniqueTags.length === 0 && !nameMatches) continue;

    hits.push({
      date,
      snippet: clipSnippet(snippetParts.filter((p) => p && !/^×\d+$/.test(p)).join(' · ') || snippetParts.join(' · ')),
      tags: uniqueTags,
    });
  }

  return hits;
}
