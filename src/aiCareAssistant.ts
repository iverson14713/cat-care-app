export type Lang = 'zh' | 'en';

export type DailyData = Record<string, boolean | string | string[]>;

export type CatProfile = {
  name: string;
  emoji: string;
  chronicNote?: string;
  allergyNote?: string;
  vetClinic?: string;
  profileNote?: string;
};

export type WeightEntry = { id: string; date: string; weight: number; note: string };

export type DayRecord = { date: string; data: DailyData };

export type AssistantCareBundleJson = {
  healthSummary: string;
  sevenDayAnalysis: string;
  vetReport: string;
};

export type AssistantWeeklyReportJson = {
  weekSummary: string;
  watchItems: string;
  nextWeekFocus: string;
};

export type AssistantContext = {
  lang: Lang;
  today: string;
  monthKey: string;
  /** Selected cat id — used for AI quota / cache keys only. */
  catId: string;
  cat: CatProfile;
  catsCount: number;
  todayDaily: DailyData;
  last7Days: DayRecord[];
  /** Newest first, max 14 days — sent to OpenAI only (not full history). */
  recentDaysForAi: DayRecord[];
  weightRecords: WeightEntry[];
  monthlyCare: Record<string, boolean>;
};

/** 簡短免責（單語，避免重複堆疊）。 */
export const AI_DISCLAIMER_SHORT_ZH =
  'AI 僅提供照護觀察與提醒，\n不能作為診斷或治療依據。\n如症狀持續或惡化，請諮詢獸醫。';

export const AI_DISCLAIMER_SHORT_EN =
  'The assistant shares care observations and reminders only —\nnot diagnosis or treatment.\nIf symptoms persist or worsen, please see a veterinarian.';

/** 在內文後附上一句免責（依介面語言擇一）。 */
export function withDisclaimer(body: string, lang: Lang): string {
  const d = lang === 'zh' ? AI_DISCLAIMER_SHORT_ZH : AI_DISCLAIMER_SHORT_EN;
  const t = body.trim();
  return t ? `${t}\n\n${d}` : d;
}

const DAILY_IDS = {
  feedMorning: 'feedMorning',
  feedNight: 'feedNight',
  snack: 'snack',
  waterCan: 'waterCan',
  pee: 'pee',
  poop: 'poop',
} as const;

function checked(data: DailyData, id: string): boolean {
  return data[id] === true;
}

function strField(data: DailyData, key: string): string {
  const v = data[key];
  return typeof v === 'string' ? v.trim() : '';
}

function photoCount(data: DailyData, key: 'dailyPhotos' | 'abnormalPhotos'): number {
  const v = data[key];
  if (!Array.isArray(v)) return 0;
  return v.filter((x) => typeof x === 'string' && x.length > 0).length;
}

function inferSpiritFromNote(note: string, lang: Lang): string | null {
  if (!note) return null;
  const n = note.toLowerCase();
  if (lang === 'zh') {
    const low = ['沒精神', '無精打采', '嗜睡', '昏睡', '無力', '躲起來', '不吃', '食慾差', '發抖', '呼吸'];
    const hi = ['活潑', '精神好', '有精神', '玩很久', '黏人', '跑跳', '正常活動'];
    if (low.some((k) => note.includes(k))) return 'zh_low';
    if (hi.some((k) => note.includes(k))) return 'zh_hi';
  } else {
    const low = ['lethargic', 'weak', 'hiding', 'not eating', 'loss of appetite', 'sleepy', 'tired'];
    const hi = ['playful', 'active', 'energetic', 'normal energy', 'happy'];
    if (low.some((k) => n.includes(k))) return 'en_low';
    if (hi.some((k) => n.includes(k))) return 'en_hi';
  }
  return null;
}

function formatSpiritHint(code: string | null, lang: Lang): string {
  if (!code) return '';
  if (lang === 'zh') {
    if (code === 'zh_low') return '今日備註裡似乎有精神或活動偏低的描述，建議持續觀察並視情況與獸醫討論。';
    if (code === 'zh_hi') return '今日備註提到較有精神或活動量，可作為日常狀態的參考。';
  } else {
    if (code === 'en_low') return 'Your daily note mentions lower energy or appetite cues — keep observing and talk with your vet if it continues.';
    if (code === 'en_hi') return 'Your daily note mentions playful or active behavior — useful as a baseline for “usual” days.';
  }
  return '';
}

export function buildTodayHealthSummary(ctx: AssistantContext): string {
  const { lang, today, cat, catsCount, todayDaily: d } = ctx;
  const lines: string[] = [];

  if (lang === 'zh') {
    lines.push(`${cat.name}，${today}：照護小結`);
    if (catsCount > 1) {
      lines.push(`你有多隻貓咪；以下僅根據目前選取的「${cat.name}」今日紀錄整理。`);
    }
    const morning = checked(d, DAILY_IDS.feedMorning);
    const night = checked(d, DAILY_IDS.feedNight);
    const snack = checked(d, DAILY_IDS.snack);
    if (morning && night) lines.push('飲食：早晚餵食都有勾選，紀錄完整。');
    else if (morning || night) lines.push('飲食：今天有部分餵食紀錄，若另一餐尚未確認，記得補上會更容易看出規律。');
    else lines.push('飲食：今天尚未勾選餵食項目，若其實有吃，建議隨手打勾方便之後對照。');

    lines.push(
      checked(d, DAILY_IDS.waterCan)
        ? '喝水／補水：有做飲水相關確認，有助觀察水分攝取習慣。'
        : '喝水／補水：尚未勾選補水確認，可依你家習慣補記，對泌尿照護追蹤很有幫助。'
    );

    const pee = checked(d, DAILY_IDS.pee);
    const poop = checked(d, DAILY_IDS.poop);
    if (pee && poop) lines.push('排尿與排便：今天都有紀錄，方便對照日常節奏。');
    else if (pee || poop) lines.push('排尿與排便：今天有部分紀錄，若另一項也確認過，建議一併勾選。');
    else lines.push('排尿與排便：今天尚未紀錄；若已觀察到排尿／排便，隨手記下有助長期趨勢。');

    const ab = strField(d, 'abnormalNote');
    const abPh = photoCount(d, 'abnormalPhotos');
    if (ab || abPh > 0) {
      lines.push(
        ab
          ? `異常紀錄：有留下文字描述（感謝你願意仔細記錄），看診時可一併給獸醫參考。${abPh > 0 ? `另有 ${abPh} 張相關照片。` : ''}`
          : `異常紀錄：有附上 ${abPh} 張照片，建議必要時在備註補一小段文字說明當時狀況，方便日後回顧。`
      );
    } else {
      lines.push('異常紀錄：今天沒有填寫異常欄位；若其實一切正常，這也是很好的紀錄。');
    }

    const dn = strField(d, 'dailyNote');
    const dp = photoCount(d, 'dailyPhotos');
    const spirit = formatSpiritHint(inferSpiritFromNote(dn, lang), lang);
    if (dn) lines.push(`今日備註：有留下日常觀察，對情緒與活動量很有幫助。${spirit ? `\n${spirit}` : ''}`);
    else if (spirit) lines.push(spirit);
    else lines.push('今日備註：若順手寫下活動、心情或玩耍狀況，之後比較容易看出「平常的精神樣貌」。');

    if (dp > 0) lines.push(`日常照片：今天有 ${dp} 張備註照片，可作為行為與外觀變化的輔助紀錄。`);

    const w = ctx.weightRecords[0];
    if (w) {
      lines.push(`體重：最近一次紀錄為 ${w.weight} kg（${w.date}）${w.note ? `，備註：${w.note}` : ''}。`);
    } else {
      lines.push('體重：尚無體重紀錄；定期量體重對中老年貓特別有參考價值。');
    }

    if (cat.chronicNote?.trim()) {
      lines.push('慢性病／用藥欄有資料：建議對照常規服藥與今日活動、食慾紀錄一起看。');
    }
  } else {
    lines.push(`${cat.name} — care notes for ${today}`);
    if (catsCount > 1) {
      lines.push(`You have multiple cats; this summary uses the currently selected cat: ${cat.name}.`);
    }
    const morning = checked(d, DAILY_IDS.feedMorning);
    const night = checked(d, DAILY_IDS.feedNight);
    if (morning && night) lines.push('Food: both morning and evening feeding checks are logged.');
    else if (morning || night) lines.push('Food: partial feeding checks today — adding the other meal helps spot patterns.');
    else lines.push('Food: no feeding checks yet today — quick taps make long-term trends easier.');

    lines.push(
      checked(d, DAILY_IDS.waterCan)
        ? 'Hydration: water / wet-food check logged — helpful for routine tracking.'
        : 'Hydration: water check not logged yet — useful for urinary health monitoring.'
    );

    const pee = checked(d, DAILY_IDS.pee);
    const poop = checked(d, DAILY_IDS.poop);
    if (pee && poop) lines.push('Litter: both pee and poop logged today.');
    else if (pee || poop) lines.push('Litter: one elimination item logged — logging both helps daily rhythm.');
    else lines.push('Litter: pee/poop not logged yet — quick notes help long-term comparisons.');

    const ab = strField(d, 'abnormalNote');
    const abPh = photoCount(d, 'abnormalPhotos');
    if (ab || abPh > 0) {
      lines.push(
        ab
          ? `Abnormal notes: text saved for your vet visit.${abPh > 0 ? ` ${abPh} related photo(s).` : ''}`
          : `Abnormal photos: ${abPh} photo(s) saved — a short note about timing/context helps later review.`
      );
    } else lines.push('Abnormal notes: none today — a calm day is still valuable data.');

    const dn = strField(d, 'dailyNote');
    const dp = photoCount(d, 'dailyPhotos');
    const spirit = formatSpiritHint(inferSpiritFromNote(dn, lang), lang);
    if (dn) lines.push(`Daily note: saved.${spirit ? ` ${spirit}` : ''}`);
    else if (spirit) lines.push(spirit);
    else lines.push('Daily note: consider jotting mood/activity — it helps define “normal” for your cat.');

    if (dp > 0) lines.push(`Daily photos: ${dp} photo(s) today — helpful behavior context.`);

    const w = ctx.weightRecords[0];
    if (w) {
      lines.push(`Weight: latest entry ${w.weight} kg (${w.date})${w.note ? `. Note: ${w.note}` : ''}.`);
    } else lines.push('Weight: no entries yet — periodic weights are especially useful for seniors.');

    if (cat.chronicNote?.trim()) {
      lines.push('Chronic conditions / meds are filled in — compare with appetite/activity when you review days.');
    }
  }

  return withDisclaimer(lines.join('\n'), lang);
}

function countTrueDays(last7: DayRecord[], id: string): number {
  return last7.filter(({ data }) => checked(data, id)).length;
}

/** 依天數比例回傳語氣：多／還可以／偏少（不顯示分數）。 */
function toneManySomeFew(count: number, n: number, _lang: Lang): 'many' | 'some' | 'few' | 'none' {
  if (n <= 0) return 'none';
  const r = count / n;
  if (r >= 0.57) return 'many';
  if (r >= 0.29) return 'some';
  if (count > 0) return 'few';
  return 'none';
}

function careWindowScore(
  tm: ReturnType<typeof toneManySomeFew>,
  tn: ReturnType<typeof toneManySomeFew>,
  tw: ReturnType<typeof toneManySomeFew>,
  tp: ReturnType<typeof toneManySomeFew>,
  tpo: ReturnType<typeof toneManySomeFew>
): number {
  const s = (t: ReturnType<typeof toneManySomeFew>) =>
    t === 'many' ? 2 : t === 'some' ? 1 : t === 'few' ? 0.4 : 0;
  return s(tm) + s(tn) + s(tw) + s(tp) + s(tpo);
}

function buildSparseSevenDayZh(_cat: { name: string }): string {
  return [
    '最近 7 天飲食與飲水紀錄較少，',
    '目前資料仍不足以建立完整趨勢。',
    '',
    '建議持續記錄：',
    '• 飲食',
    '• 飲水',
    '• 排尿',
    '• 體重',
    '',
    '當資料更完整時，',
    'AI 將能提供更有參考價值的照護觀察。',
  ].join('\n');
}

function buildSparseSevenDayEn(cat: { name: string }): string {
  return [
    `In the last week, ${cat.name}'s food and hydration notes are still light,`,
    'so we do not yet have enough detail for a full trend.',
    '',
    'When you can, keep logging:',
    '• Meals',
    '• Water / hydration',
    '• Pee / litter box',
    '• Weight',
    '',
    'As your records grow,',
    'the assistant can offer richer, kinder care observations.',
  ].join('\n');
}

export function buildSevenDayAnalysis(ctx: AssistantContext): string {
  const { lang, cat, catsCount, last7Days } = ctx;
  const lines: string[] = [];
  const n = last7Days.length;
  const dates = new Set(last7Days.map((x) => x.date));
  const weights7 = ctx.weightRecords.filter((w) => dates.has(w.date));

  if (lang === 'zh') {
    if (n === 0) {
      return buildSparseSevenDayZh(cat);
    }

    const cm = countTrueDays(last7Days, DAILY_IDS.feedMorning);
    const cn = countTrueDays(last7Days, DAILY_IDS.feedNight);
    const cw = countTrueDays(last7Days, DAILY_IDS.waterCan);
    const cp = countTrueDays(last7Days, DAILY_IDS.pee);
    const cpo = countTrueDays(last7Days, DAILY_IDS.poop);
    const tm = toneManySomeFew(cm, n, lang);
    const tn = toneManySomeFew(cn, n, lang);
    const tw = toneManySomeFew(cw, n, lang);
    const tp = toneManySomeFew(cp, n, lang);
    const tpo = toneManySomeFew(cpo, n, lang);
    const score = careWindowScore(tm, tn, tw, tp, tpo);
    if ((n >= 3 && score < 2.4) || (n > 0 && n < 3 && score < 1.2)) {
      return buildSparseSevenDayZh(cat);
    }

    lines.push(
      `${cat.name} 最近這幾天，從紀錄裡感受到你陪牠吃飯的節奏：${
        tm === 'many' && tn === 'many'
          ? '早、晚都有常常留下小勾勾，看起來很穩定。'
          : tm === 'few' && tn === 'few'
            ? '早餐跟晚餐的紀錄偏少，若其實都有餵，隨手勾一下之後比較看得出習慣。'
            : tm === 'many' || tn === 'many'
              ? '有幾天有好好記到餵食，其餘可以再慢慢補齊，不用有壓力。'
              : '有時會記、有時還沒記，慢慢養成習慣就很好。'
      }`
    );

    lines.push(
      tw === 'many'
        ? '喝水的確認也寫得蠻勤的，對觀察牠喝多喝少很有幫助。'
        : tw === 'none'
          ? '這段時間幾乎還沒有補水／飲水的小確認；若你本來就會看水碗，偶爾記一筆也很棒。'
          : '有時會記到喝水相關的確認，再密集一點點，之後比較容易感覺到變化。'
    );

    lines.push(
      tp === 'many' && tpo === 'many'
        ? '尿尿跟便便也都有常常留下紀錄，對照日常節奏會很安心。'
        : tp === 'few' && tpo === 'few'
          ? '尿尿、便便的勾選還不多；若其實都有上廁所，隨手記一下之後回顧會更清楚。'
          : '排尿或排便其中一項記得比較多，另一項也可以慢慢補上，畫面會更完整。'
    );

    const daysWithNote = last7Days.filter(({ data }) => strField(data, 'dailyNote').length > 0).length;
    const daysWithAb = last7Days.filter(
      ({ data }) => strField(data, 'abnormalNote').length > 0 || photoCount(data, 'abnormalPhotos') > 0
    ).length;
    const noteTone = toneManySomeFew(daysWithNote, n, lang);
    const abTone = toneManySomeFew(daysWithAb, n, lang);
    lines.push(
      noteTone === 'many'
        ? '「今天發生的小事」也寫得蠻多的，之後看精神跟活動會很有畫面。'
        : noteTone === 'some'
          ? '有幾天有寫下日常小事，若願意多寫一點點心情或玩耍，之後會更溫暖。'
          : '日常小筆記還不多，順手寫一句「今天很黏人」之類的，之後會很珍貴。'
    );
    lines.push(
      abTone === 'many'
        ? '這段時間也有幾天留下異常或照片，辛苦了；看診時這些都很有用。'
        : abTone === 'none'
          ? '這幾天沒有特別留下異常紀錄，若牠其實一直都穩定，也是很好的消息。'
          : '偶爾會記到需要多留意的小狀況，記得照顧好自己的心情。'
    );

    if (weights7.length >= 2) {
      const sorted = [...weights7].sort((a, b) => a.date.localeCompare(b.date));
      const first = sorted[0]!.weight;
      const last = sorted[sorted.length - 1]!.weight;
      const delta = Math.round((last - first) * 100) / 100;
      const up = delta > 0.05;
      const down = delta < -0.05;
      lines.push(
        up
          ? `體重在這段時間有緩緩往上走一點點，只是家裡量的參考，要不要多留意，還是交給獸醫一起聊比較安心。`
          : down
            ? `體重看起來輕了一點點，也可能是水分或測量時間差，別自己嚇自己，有疑慮就問獸醫。`
            : `體重在這段時間大致持平，當作日常小參考就好。`
      );
    } else if (weights7.length === 1) {
      lines.push('有量到一次體重，若之後固定時間再量幾次，趨勢會更可愛地浮現出來。');
    } else {
      lines.push('這段時間還沒有體重紀錄，若方便的話，偶爾抱去秤一下也會多一個照護角度。');
    }

    if (catsCount > 1) {
      lines.push(`家裡還有其他貓咪的話，記得切換一下畫面，每一隻都有自己的小故事。`);
    }

    const vet = ctx.monthlyCare.vetVisit === true;
    lines.push(
      vet
        ? '這個月有把看診或回診記在定期清單裡，若快要赴約，可以把這幾天的小紀錄一起帶去。'
        : '若這幾天心裡有點不放心，把備註與照片整理好，找信任的獸醫聊一聊，會比較踏實。'
    );

    lines.push('以上依你儲存的紀錄整理，每位貓主習慣不同，當作生活裡的小提醒就好。');
  } else {
    if (n === 0) {
      return buildSparseSevenDayEn(cat);
    }

    const cm = countTrueDays(last7Days, DAILY_IDS.feedMorning);
    const cn = countTrueDays(last7Days, DAILY_IDS.feedNight);
    const cw = countTrueDays(last7Days, DAILY_IDS.waterCan);
    const cp = countTrueDays(last7Days, DAILY_IDS.pee);
    const cpo = countTrueDays(last7Days, DAILY_IDS.poop);
    const tm = toneManySomeFew(cm, n, lang);
    const tn = toneManySomeFew(cn, n, lang);
    const tw = toneManySomeFew(cw, n, lang);
    const tp = toneManySomeFew(cp, n, lang);
    const tpo = toneManySomeFew(cpo, n, lang);
    const score = careWindowScore(tm, tn, tw, tp, tpo);
    if ((n >= 3 && score < 2.4) || (n > 0 && n < 3 && score < 1.2)) {
      return buildSparseSevenDayEn(cat);
    }

    lines.push(
      `For ${cat.name} these last few days, feeding check-ins feel ${
        tm === 'many' && tn === 'many'
          ? 'steady — mornings and evenings show up often, which is lovely.'
          : tm === 'few' && tn === 'few'
            ? 'light — if meals still happened, quick taps later will make patterns easier to sense.'
            : tm === 'many' || tn === 'many'
              ? 'mixed — a few strong days, and room to grow without pressure.'
              : 'gentle and human — logging can grow at your pace.'
      }`
    );

    lines.push(
      tw === 'many'
        ? 'Hydration checks show up often — great for noticing small shifts.'
        : tw === 'none'
          ? 'Hydration checks are rare in this window — even occasional notes help over time.'
          : 'Hydration shows up sometimes — a few more notes can make trends easier to feel.'
    );

    lines.push(
      tp === 'many' && tpo === 'many'
        ? 'Litter notes for pee and poop both look consistent — comforting for daily rhythm.'
        : tp === 'few' && tpo === 'few'
          ? 'Pee/poop check-ins are still sparse — if everything is normal, quick logs still help later.'
          : 'One side of litter logging shows up more than the other — filling in both sides paints a fuller picture.'
    );

    const daysWithNote = last7Days.filter(({ data }) => strField(data, 'dailyNote').length > 0).length;
    const daysWithAb = last7Days.filter(
      ({ data }) => strField(data, 'abnormalNote').length > 0 || photoCount(data, 'abnormalPhotos') > 0
    ).length;
    const noteTone = toneManySomeFew(daysWithNote, n, lang);
    const abTone = toneManySomeFew(daysWithAb, n, lang);
    lines.push(
      noteTone === 'many'
        ? 'Daily notes show up often — they add warmth when you look back at mood and play.'
        : noteTone === 'some'
          ? 'A few daily notes are here — tiny sentences about mood go a long way.'
          : 'Daily notes are still quiet — a single line like “extra cuddly today” becomes a treasure later.'
    );
    lines.push(
      abTone === 'many'
        ? 'Some days include abnormal notes or photos — those details matter for vet visits.'
        : abTone === 'none'
          ? 'No abnormal notes in this window — if life felt calm, that is good news too.'
          : 'A handful of days mention something unusual — be kind to yourself as you observe.'
    );

    if (weights7.length >= 2) {
      const sorted = [...weights7].sort((a, b) => a.date.localeCompare(b.date));
      const first = sorted[0]!.weight;
      const last = sorted[sorted.length - 1]!.weight;
      const delta = Math.round((last - first) * 100) / 100;
      const up = delta > 0.05;
      const down = delta < -0.05;
      lines.push(
        up
          ? 'Weight drifts a little upward in this window — home scales vary, so chat with your vet if you are unsure.'
          : down
            ? 'Weight looks a touch lower — hydration and timing can sway readings; ask your vet if worried.'
            : 'Weight looks fairly steady in this window — a soft reference, not a verdict.'
      );
    } else if (weights7.length === 1) {
      lines.push('One weight entry is here — a few more regular weigh-ins make trends easier to sense.');
    } else {
      lines.push('No weights in this window yet — occasional weigh-ins add another caring angle.');
    }

    if (catsCount > 1) {
      lines.push('If you have more cats, switch profiles — each one has their own little story.');
    }

    const vet = ctx.monthlyCare.vetVisit === true;
    lines.push(
      vet
        ? 'A vet visit is marked for this month — bringing this week’s notes can make conversations smoother.'
        : 'If something feels off, bundling notes and photos for your veterinarian is the calmest next step.'
    );

    lines.push('This is generated from your saved logs; every household is different — treat it as a gentle nudge.');
  }

  return lines.join('\n\n');
}

export function buildAbnormalAlerts(ctx: AssistantContext): string {
  const { lang, cat, last7Days } = ctx;
  const hits = last7Days.filter(
    ({ data }) => strField(data, 'abnormalNote').length > 0 || photoCount(data, 'abnormalPhotos') > 0
  );

  const lines: string[] = [];
  if (lang === 'zh') {
    lines.push(`${cat.name}：最近幾天的異常紀錄`);
    if (hits.length === 0) {
      lines.push('這 7 天沒有留下異常文字或異常照片；若貓咪其實一切穩定，這是很好的狀態。');
      lines.push('若只是忘記填寫，之後有狀況仍建議簡短記下時間與情境，方便回顧。');
    } else {
      lines.push(`有 ${hits.length} 天曾留下異常相關紀錄：`);
      hits.slice(0, 5).forEach((h) => {
        const t = strField(h.data, 'abnormalNote');
        const ph = photoCount(h.data, 'abnormalPhotos');
        const short = t.length > 80 ? `${t.slice(0, 80)}…` : t;
        lines.push(`· ${h.date}${t ? `：${short}` : '（僅照片）'}${ph ? `〔照片 ${ph} 張〕` : ''}`);
      });
      if (hits.length > 5) lines.push(`… 另有 ${hits.length - 5} 天也有異常紀錄，可到「歷史」頁完整查看。`);
      lines.push('提醒：這裡只做紀錄整理與就醫準備提醒，不判斷是否「生病」或嚴重程度。');
    }
  } else {
    lines.push(`${cat.name}: abnormal notes in recent days`);
    if (hits.length === 0) {
      lines.push('No abnormal text/photos in the last 7 days — if that matches reality, great.');
      lines.push('If something happened but wasn’t logged, short notes with timing help later review.');
    } else {
      lines.push(`${hits.length} day(s) include abnormal notes/photos:`);
      hits.slice(0, 5).forEach((h) => {
        const t = strField(h.data, 'abnormalNote');
        const ph = photoCount(h.data, 'abnormalPhotos');
        const short = t.length > 120 ? `${t.slice(0, 120)}…` : t;
        lines.push(`· ${h.date}${t ? `: ${short}` : ' (photos only)'}${ph ? ` [${ph} photo(s)]` : ''}`);
      });
      if (hits.length > 5) lines.push(`… ${hits.length - 5} more day(s) — see History for full detail.`);
      lines.push('Reminder: this only organizes records; it does not judge illness severity.');
    }
  }

  return withDisclaimer(lines.join('\n'), lang);
}

export function buildVetReportAiSummary(ctx: AssistantContext): string {
  const { lang, cat, weightRecords, today } = ctx;
  const lines: string[] = [];

  const latest = weightRecords[0];
  const recent =
    weightRecords.length > 1 ? weightRecords[Math.min(weightRecords.length - 1, 4)] : undefined;
  let delta = 0;
  if (latest && recent && latest.id !== recent.id) delta = Math.round((latest.weight - recent.weight) * 100) / 100;

  const allHist = ctx.last7Days.filter(
    ({ data }) =>
      strField(data, 'abnormalNote') ||
      strField(data, 'dailyNote') ||
      photoCount(data, 'abnormalPhotos') ||
      photoCount(data, 'dailyPhotos')
  );

  if (lang === 'zh') {
    lines.push(`${cat.name}：就診前可帶著看的紀錄重點`);
    lines.push(
      `基本背景：${cat.chronicNote?.trim() ? '有填慢性病／用藥。' : '尚未填慢性病／用藥。'}${cat.allergyNote?.trim() ? '有過敏／禁忌備註。' : ''}${cat.vetClinic?.trim() ? `常用獸醫院：${cat.vetClinic}。` : ''}`
    );
    lines.push(
      latest
        ? `體重：最新 ${latest.weight} kg（${latest.date}）${weightRecords.length >= 2 ? `，與近期紀錄相比約 ${delta >= 0 ? '+' : ''}${delta} kg（趨勢參考）。` : '。'}`
        : '體重：尚無紀錄，看診時可請獸醫一併討論量測方式。'
    );
    lines.push(
      allHist.length > 0
        ? `最近 7 天內有 ${allHist.length} 天含備註、異常或照片紀錄，建議看診時搭配「獸醫」頁面完整內容與照片。`
        : '最近 7 天幾乎沒有備註或照片；若即將看診，可補記最近食慾、排尿排便與精神變化。'
    );
    lines.push(`以上整理到今天為止；完整內容仍以 App 內「獸醫」分頁為準。`);
  } else {
    lines.push(`${cat.name}: highlights for your vet visit`);
    lines.push(
      `Background: ${cat.chronicNote?.trim() ? 'Chronic/meds filled in.' : 'No chronic/meds filled in.'} ${cat.allergyNote?.trim() ? 'Allergies noted.' : ''} ${cat.vetClinic?.trim() ? `Clinic: ${cat.vetClinic}.` : ''}`
    );
    lines.push(
      latest
        ? `Weight: latest ${latest.weight} kg (${latest.date})${weightRecords.length >= 2 ? `; rough delta vs recent entries ≈ ${delta >= 0 ? '+' : ''}${delta} kg.` : '.'}`
        : 'Weight: none logged yet — ask your vet about a weighing routine.'
    );
    lines.push(
      allHist.length > 0
        ? `${allHist.length} day(s) in the last week include notes/abnormal/photos — bring the Vet tab details to the visit.`
        : 'Few notes/photos in the last week — consider adding appetite, litter, and energy notes before the visit.'
    );
    lines.push(`Snapshot as of ${today} — your Vet tab remains the full source.`);
  }

  return withDisclaimer(lines.join('\n'), lang);
}

function normalizeQ(q: string): string {
  return q.trim().toLowerCase();
}

export function answerAssistantQuestion(raw: string, ctx: AssistantContext): string {
  const q = normalizeQ(raw);
  const { lang } = ctx;

  if (!raw.trim()) {
    const body =
      lang === 'zh'
        ? '可以試著問：「這週喝水紀錄怎樣？」「體重要注意什麼？」「異常紀錄多嗎？」我會依你已存的紀錄用溫和的方式整理重點。'
        : 'Try asking about hydration checks, weight trend, or abnormal notes — I will summarize only from your saved records.';
    return withDisclaimer(body, lang);
  }

  let body = '';

  if (lang === 'zh') {
    const has = (keys: string[]) => keys.some((k) => q.includes(k));

    if (has(['你好', '嗨', 'hello', 'hi'])) {
      body = `嗨，我是照護小助理，會陪你看「${ctx.cat.name}」的紀錄整理。你可以問飲食、喝水、大小便、體重或異常相關的問題；我不會診斷或開藥，只幫你把已記下的內容說清楚。`;
    } else if (has(['飲食', '吃', '餵', '食量', 'feed', 'food', 'eat'])) {
      const n = ctx.last7Days.length;
      const m = countTrueDays(ctx.last7Days, DAILY_IDS.feedMorning);
      const e = countTrueDays(ctx.last7Days, DAILY_IDS.feedNight);
      body = `過去 7 天裡，你有 ${m} 天勾選早上餵食、${e} 天勾選晚上餵食（共 ${n} 天區間）。這能幫你回想規律，但不能推測食量是否「正常」——若擔心食慾，請把實際狀況記在備註並諮詢獸醫。`;
    } else if (has(['水', '喝', '補水', 'water', 'hydration', 'drink'])) {
      const n = countTrueDays(ctx.last7Days, DAILY_IDS.waterCan);
      body = `過去 7 天中，有 ${n} 天有勾選補水／飲水確認。排尿狀況也可一併看：同期「有尿尿」紀錄為 ${countTrueDays(ctx.last7Days, DAILY_IDS.pee)} 天。若你擔心泌尿方面，請以獸醫評估為準。`;
    } else if (has(['尿', 'pee', '泌尿'])) {
      body = `最近 7 天你有 ${countTrueDays(ctx.last7Days, DAILY_IDS.pee)} 天勾選「有尿尿」。這只是居家觀察紀錄，無法判斷頻率或量是否異常；若有排尿困難、血尿等狀況，請儘快諮詢獸醫。`;
    } else if (has(['便', '大便', 'poop', 'stool'])) {
      body = `最近 7 天你有 ${countTrueDays(ctx.last7Days, DAILY_IDS.poop)} 天勾選「有大便」。形狀與軟硬度請以你實際觀察寫在備註／異常欄；我無法從勾選本身判斷是否正常。`;
    } else if (has(['體重', 'weight', '胖', '瘦'])) {
      const w = ctx.weightRecords[0];
      if (!w) body = '還沒有體重資料。建議固定時間測量並記下，之後比較趨勢會更有幫助。';
      else {
        const older =
          ctx.weightRecords.length > 1
            ? ctx.weightRecords[Math.min(ctx.weightRecords.length - 1, 4)]
            : undefined;
        const d =
          older && w.id !== older.id ? Math.round((w.weight - older.weight) * 100) / 100 : null;
        body = `最新體重 ${w.weight} kg（${w.date}）${d !== null ? `，與稍早一筆紀錄相差約 ${d >= 0 ? '+' : ''}${d} kg。` : '。'}體重變化可能與許多因素有關，是否需調整飲食或檢查，請與獸醫討論。`;
      }
    } else if (has(['異常', '吐', '拉', '血', 'abnormal', 'vomit', 'diarrhea'])) {
      const hits = ctx.last7Days.filter(
        ({ data }) => strField(data, 'abnormalNote') || photoCount(data, 'abnormalPhotos') > 0
      );
      body =
        hits.length === 0
          ? '最近 7 天沒有異常文字或異常照片紀錄。若其實有狀況，建議補記；若持續不舒服，請諮詢獸醫。'
          : `最近 7 天有 ${hits.length} 天曾留下異常相關紀錄。建議你到「歷史」或「獸醫」頁整理時間序，就診時給獸醫參考；我無法判斷嚴重程度。`;
    } else if (has(['獸醫', '醫院', 'vet', 'clinic', '看診'])) {
      body = ctx.cat.vetClinic?.trim()
        ? `你有填常用獸醫院：${ctx.cat.vetClinic}。就診前可把「獸醫」分頁的摘要與照片備妥；是否需要看診或檢查，仍由獸醫判斷。`
        : '尚未填常用獸醫院。若即將看診，建議補上院名與地址，並把這週的備註與照片一併整理。';
    } else if (has(['精神', '活動', '心情', 'energy', 'mood', 'play'])) {
      const withNote = ctx.last7Days.filter(({ data }) => strField(data, 'dailyNote').length > 0).length;
      body = `精神與活動量較適合寫在「今日備註」裡用文字描述。這 7 天你有 ${withNote} 天有寫備註；若加上具體行為（玩耍、睡眠、互動），之後比較容易對照。我無法從少數字句判讀健康狀態。`;
    } else if (has(['照片', '圖', 'photo', 'picture'])) {
      let ab = 0;
      let daily = 0;
      ctx.last7Days.forEach(({ data }) => {
        ab += photoCount(data, 'abnormalPhotos');
        daily += photoCount(data, 'dailyPhotos');
      });
      body = `這 7 天內你大約累積了 ${daily} 張日常照片、${ab} 張異常相關照片（依紀錄欄位計數）。照片有助獸醫了解外觀變化，但仍需現場檢查才能完整評估。`;
    } else if (has(['藥', '診斷', '生病', 'med', 'diagnosis', 'disease', 'sick'])) {
      body = '我無法提供用藥、診斷或是否生病的判斷。若你擔心健康狀況，請把症狀與時間記錄下來並諮詢獸醫。';
    } else {
      body =
        '從最近的紀錄來看，喝水、排尿與排便的小勾勾有時多、有時少，都很正常；若想更立體，可把今天的小故事與照片慢慢補上。需要醫療決策時，還是要交給獸醫。';
    }
  } else {
    const has = (keys: string[]) => keys.some((k) => q.includes(k));
    if (has(['你好', '嗨', 'hello', 'hi', 'hey'])) {
      body = `Hi — I help summarize saved records for ${ctx.cat.name}. Ask about food, water, litter, weight, or abnormal notes. I do not diagnose or prescribe.`;
    } else if (has(['food', 'feed', 'eat', 'meal'])) {
      const n = ctx.last7Days.length;
      const m = countTrueDays(ctx.last7Days, DAILY_IDS.feedMorning);
      const e = countTrueDays(ctx.last7Days, DAILY_IDS.feedNight);
      body = `In the last ${n} days: morning feeding checks ${m}, evening checks ${e}. This is logging consistency — it cannot prove appetite is “normal”. If appetite worries you, note details and ask your vet.`;
    } else if (has(['water', 'hydration', 'drink'])) {
      const n = countTrueDays(ctx.last7Days, DAILY_IDS.waterCan);
      body = `Hydration checks logged on ${n} of the last 7 days. Pee checks: ${countTrueDays(ctx.last7Days, DAILY_IDS.pee)} days. Urinary concerns need a vet’s evaluation.`;
    } else if (has(['pee', 'urin'])) {
      body = `Pee logged on ${countTrueDays(ctx.last7Days, DAILY_IDS.pee)} of the last 7 days. Logging can’t assess volume or straining — contact your vet for urinary emergencies/red flags.`;
    } else if (has(['poop', 'stool'])) {
      body = `Poop logged on ${countTrueDays(ctx.last7Days, DAILY_IDS.poop)} of the last 7 days. Stool quality belongs in your notes; I can’t judge “normal” from checkmarks alone.`;
    } else if (has(['weight', 'fat', 'thin'])) {
      const w = ctx.weightRecords[0];
      if (!w) body = 'No weights yet — regular weigh-ins make trends meaningful.';
      else {
        const older =
          ctx.weightRecords.length > 1
            ? ctx.weightRecords[Math.min(ctx.weightRecords.length - 1, 4)]
            : undefined;
        const d =
          older && w.id !== older.id ? Math.round((w.weight - older.weight) * 100) / 100 : null;
        body = `Latest weight ${w.weight} kg (${w.date})${d !== null ? `; rough delta vs an earlier recent entry ≈ ${d >= 0 ? '+' : ''}${d} kg.` : '.'} Discuss changes with your vet.`;
      }
    } else if (has(['abnormal', 'vomit', 'diarrhea', 'blood'])) {
      const hits = ctx.last7Days.filter(
        ({ data }) => strField(data, 'abnormalNote') || photoCount(data, 'abnormalPhotos') > 0
      );
      body =
        hits.length === 0
          ? 'No abnormal notes/photos in the last 7 days. If something happened, consider logging it; if unwell, ask your vet.'
          : `${hits.length} day(s) include abnormal notes/photos — review History/Vet tabs; I can’t judge severity.`;
    } else if (has(['vet', 'clinic', 'visit'])) {
      body = ctx.cat.vetClinic?.trim()
        ? `Preferred clinic saved: ${ctx.cat.vetClinic}. Bring the Vet tab summary/photos — whether a visit is needed is for your vet to decide.`
        : 'No preferred clinic saved yet — add it before visits and bundle this week’s notes/photos.';
    } else if (has(['energy', 'mood', 'play', 'spirit'])) {
      const withNote = ctx.last7Days.filter(({ data }) => strField(data, 'dailyNote').length > 0).length;
      body = `Energy/mood fits best in daily notes — you logged notes on ${withNote} of the last 7 days. I can’t infer health status from short text alone.`;
    } else if (has(['photo', 'picture', 'image'])) {
      let ab = 0;
      let daily = 0;
      ctx.last7Days.forEach(({ data }) => {
        ab += photoCount(data, 'abnormalPhotos');
        daily += photoCount(data, 'dailyPhotos');
      });
      body = `Rough photo counts in the last week: ${daily} daily photo(s), ${ab} abnormal-related photo(s). Photos help, but exams are still needed for medical assessment.`;
    } else if (has(['med', 'medicine', 'diagnosis', 'disease', 'drug', 'rx'])) {
      body = 'I can’t prescribe, diagnose, or judge illness. Please record symptoms with timing and consult your veterinarian.';
    } else {
      body =
        'From your recent logs, hydration and litter check-ins come and go — that is human. Add a few daily notes or photos when you can for richer context. Medical decisions still belong to your veterinarian.';
    }
  }

  return withDisclaimer(body, lang);
}
