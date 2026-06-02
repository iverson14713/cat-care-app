export type StreakStats = {
  /** Consecutive days with a daily record, counting back from today (0 if today has no record). */
  currentStreak: number;
  /** Best consecutive streak across all records. */
  bestStreak: number;
  /** Most recent record date (YYYY-MM-DD) or null when none exist. */
  lastRecordDate: string | null;
  /** Days since last record (0 = today). Null when no records exist. */
  daysSinceLastRecord: number | null;
};

function ymdToLocalDayNumber(ymd: string): number | null {
  // Treat as local date; safe for YYYY-MM-DD.
  const d = new Date(`${ymd}T00:00:00`);
  const t = d.getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor(t / 86400000);
}

function localDayNumberToYmd(day: number): string {
  const d = new Date(day * 86400000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function computeStreakStats(params: {
  recordDates: string[];
  todayYmd: string;
}): StreakStats {
  const todayDay = ymdToLocalDayNumber(params.todayYmd);
  const uniqDays = new Set<number>();
  for (const d of params.recordDates) {
    const day = ymdToLocalDayNumber(d);
    if (day != null) uniqDays.add(day);
  }

  const dayNumbers = Array.from(uniqDays).sort((a, b) => a - b);
  const lastDay = dayNumbers.length ? dayNumbers[dayNumbers.length - 1] : null;
  const lastRecordDate = lastDay == null ? null : localDayNumberToYmd(lastDay);

  let daysSinceLastRecord: number | null = null;
  if (todayDay != null && lastDay != null) {
    daysSinceLastRecord = Math.max(0, todayDay - lastDay);
  }

  let currentStreak = 0;
  if (todayDay != null) {
    while (uniqDays.has(todayDay - currentStreak)) currentStreak += 1;
  }

  let bestStreak = 0;
  let run = 0;
  let prev: number | null = null;
  for (const day of dayNumbers) {
    if (prev == null || day !== prev + 1) run = 1;
    else run += 1;
    if (run > bestStreak) bestStreak = run;
    prev = day;
  }

  return { currentStreak, bestStreak, lastRecordDate, daysSinceLastRecord };
}

export function streakCopyZh(params: {
  petName: string;
  stats: StreakStats;
}): { title: string; subtitle: string } {
  const name = params.petName || '毛孩';
  const { currentStreak, bestStreak, daysSinceLastRecord } = params.stats;

  if (daysSinceLastRecord != null && daysSinceLastRecord > 1) {
    return { title: '想你了', subtitle: `${name} 好像在等你回來記錄今天的狀況。` };
  }

  if (currentStreak <= 0) {
    return { title: '今天開始照顧囉', subtitle: `記錄一下 ${name} 今天的照護狀況，累積連續照顧天數。` };
  }

  if (currentStreak === 1) {
    return { title: '連續照顧 1 天', subtitle: `很棒！今天開始一起把 ${name} 的照護記錄維持下去。` };
  }
  if (currentStreak >= 14) {
    return { title: `已連續照顧 ${currentStreak} 天`, subtitle: `你是超可靠的主人，${name} 很安心。` };
  }
  if (currentStreak >= 7) {
    return { title: `已連續照顧 ${currentStreak} 天`, subtitle: `${name} 很安心，照護節奏很穩定。` };
  }
  if (currentStreak >= 3) {
    return { title: `已連續照顧 ${currentStreak} 天`, subtitle: `照顧越來越穩定，繼續加油！` };
  }
  return { title: `已連續照顧 ${currentStreak} 天`, subtitle: `保持記錄，越來越好掌握 ${name} 的日常狀況。` };
}

