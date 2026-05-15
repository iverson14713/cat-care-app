import { useCallback, useMemo, useRef, useState } from 'react';
import {
  buildVetReport,
  buildVetReportContextText,
  clampRangeForFree,
  computeVetReportDateRange,
  type VetReportAiSummary,
  type VetReportCatProfile,
  type VetReportDatePreset,
  type VetReportPayload,
  type VetReportSections,
} from './vetReportData';
import { generateVetReportAiSummary, VetReportApiError } from './vetReportAi';
import {
  canExportVetPdf,
  canUseVetAiSummary,
  maxVetReportDays,
  recordVetAiUsedToday,
} from './vetReportLimits';
import { exportReportElementAsPdf, exportReportElementAsPng, shareReportText } from './vetReportExport';

type Lang = 'zh' | 'en';
type AppPlan = 'free' | 'pro';

type CatRow = {
  id: string;
  name: string;
  emoji: string;
  birthday?: string;
  gender?: string;
  breed?: string;
  chronicNote?: string;
  allergyNote?: string;
  vetClinic?: string;
  profileNote?: string;
};

type WeightPoint = { id: string; date: string; weight: number; note: string };

const copy = {
  zh: {
    title: '進階獸醫報告',
    lead: '整理照護紀錄給獸醫參考，非醫療診斷。',
    proBadge: 'Pro',
    freeBanner: '免費版：僅預覽最近 7 天，不可匯出 PDF／圖片；AI 整理每日 1 次。',
    upgrade: '升級 Pro 測試版解鎖完整功能',
    openSettings: '方案與設定',
    cat: '貓咪',
    range: '日期範圍',
    preset7: '最近 7 天',
    preset30: '最近 30 天',
    presetCustom: '自訂',
    dateStart: '起始',
    dateEnd: '結束',
    sections: '包含內容',
    secAbnormal: '異常紀錄',
    secWeight: '體重紀錄',
    secPhotos: '照片',
    secNotes: '備註',
    secAi: 'AI 摘要',
    generate: '產生報告',
    aiBtn: 'AI 幫我整理重點',
    aiBusy: 'AI 整理中…',
    aiLimit: '今日免費版 AI 整理已用完（每日 1 次）',
    exportPdf: '匯出 PDF',
    exportPng: '匯出圖片',
    share: '分享文字',
    sharedOk: '已複製／分享報告文字',
    shareFail: '無法分享',
    exportProOnly: '匯出為 Pro 功能',
    profile: '貓咪基本資料',
    abnormalSummary: '最近異常摘要',
    noAbnormal: '此期間無異常備註',
    weightTrend: '體重趨勢',
    noWeight: '此期間無體重紀錄',
    timeline: '時間線',
    noTimeline: '此期間無相關紀錄',
    photos: '照片',
    noPhotos: '此期間無照片',
    aiSection: 'AI 整理重點',
    watchItems: '最近需注意',
    observe: '建議觀察方向',
    vetHandoff: '帶給獸醫的重點',
    disclaimer:
      '本報告僅供照護紀錄整理與就診溝通參考，不構成診斷或醫療建議。若症狀持續或惡化，請諮詢獸醫。',
    previewLocked: '升級 Pro 可查看完整報告並匯出',
    name: '名字',
    age: '年齡',
    birthday: '生日',
    gender: '性別',
    breed: '品種',
    chronic: '慢性病',
    allergy: '過敏',
    clinic: '常用獸醫院',
    note: '備註',
    unknown: '未填',
    yearsOld: '歲',
    weightChange: '近期變化',
    latestWeight: '最近體重',
  },
  en: {
    title: 'Advanced vet report',
    lead: 'Care log handoff for your vet — not a medical diagnosis.',
    proBadge: 'Pro',
    freeBanner: 'Free: preview last 7 days only; no PDF/image export; 1 AI summary per day.',
    upgrade: 'Upgrade to Pro (test) for full access',
    openSettings: 'Plan & settings',
    cat: 'Cat',
    range: 'Date range',
    preset7: 'Last 7 days',
    preset30: 'Last 30 days',
    presetCustom: 'Custom',
    dateStart: 'From',
    dateEnd: 'To',
    sections: 'Include',
    secAbnormal: 'Abnormal notes',
    secWeight: 'Weight',
    secPhotos: 'Photos',
    secNotes: 'Notes',
    secAi: 'AI summary',
    generate: 'Generate report',
    aiBtn: 'AI summarize highlights',
    aiBusy: 'Summarizing…',
    aiLimit: "Today's free AI summary used (1 per day)",
    exportPdf: 'Export PDF',
    exportPng: 'Export image',
    share: 'Share text',
    sharedOk: 'Report text copied / shared',
    shareFail: 'Could not share',
    exportProOnly: 'Export is a Pro feature',
    profile: 'Profile',
    abnormalSummary: 'Recent concerns',
    noAbnormal: 'No abnormal notes in this period',
    weightTrend: 'Weight trend',
    noWeight: 'No weight entries in this period',
    timeline: 'Timeline',
    noTimeline: 'No entries in this period',
    photos: 'Photos',
    noPhotos: 'No photos in this period',
    aiSection: 'AI highlights',
    watchItems: 'Watch for',
    observe: 'Observation ideas',
    vetHandoff: 'For your vet',
    disclaimer:
      'This report organizes care logs for visit communication only — not diagnosis or treatment advice.',
    previewLocked: 'Upgrade to Pro for the full report and exports',
    name: 'Name',
    age: 'Age',
    birthday: 'Birthday',
    gender: 'Gender',
    breed: 'Breed',
    chronic: 'Chronic conditions',
    allergy: 'Allergies',
    clinic: 'Vet clinic',
    note: 'Notes',
    unknown: '—',
    yearsOld: 'y/o',
    weightChange: 'Recent change',
    latestWeight: 'Latest weight',
  },
} as const;

function calculateAgeText(
  birthday: string | undefined,
  lang: Lang,
  yearsOld: string,
  unknown: string
): string {
  if (!birthday) return unknown;
  const birthDate = new Date(birthday);
  if (Number.isNaN(birthDate.getTime())) return unknown;
  const now = new Date();
  let years = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  const dayDiff = now.getDate() - birthDate.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) years -= 1;
  if (years <= 0) {
    const months = Math.max(0, (now.getFullYear() - birthDate.getFullYear()) * 12 + monthDiff);
    return lang === 'zh' ? `約 ${months} 個月` : `about ${months} months`;
  }
  return lang === 'zh' ? `約 ${years} ${yearsOld}` : `about ${years} ${yearsOld}`;
}

function WeightSparkline({ points }: { points: { date: string; weight: number }[] }) {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return null;
  const w = 300;
  const h = 120;
  const pad = 20;
  const weights = sorted.map((p) => p.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const coords = sorted.map((p, i) => {
    const x = pad + (i / (sorted.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p.weight - min) / range) * (h - pad * 2);
    return { x, y };
  });
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full rounded-2xl bg-stone-50/80">
      <path d={path} fill="none" stroke="#fb923c" strokeWidth="3" strokeLinecap="round" />
      {coords.map((c) => (
        <circle key={c.x} cx={c.x} cy={c.y} r="4" fill="#fb923c" />
      ))}
    </svg>
  );
}

function formatDisplayDate(date: string, lang: Lang): string {
  const [y, m, d] = date.split('-');
  if (lang === 'zh') return `${Number(m)}/${Number(d)}`;
  return `${m}/${d}`;
}

export type VetReportPageProps = {
  lang: Lang;
  appPlan: AppPlan;
  cats: CatRow[];
  selectedCatId: string;
  onSelectCatId: (id: string) => void;
  today: string;
  clientId: string;
  onOpenPhoto: (url: string) => void;
  onGoSettings: () => void;
  catSwitcher: React.ReactNode;
};

export function VetReportPage({
  lang,
  appPlan,
  cats,
  selectedCatId,
  onSelectCatId,
  today,
  clientId,
  onOpenPhoto,
  onGoSettings,
  catSwitcher,
}: VetReportPageProps) {
  const t = copy[lang];
  const isPro = appPlan === 'pro';
  const reportRef = useRef<HTMLDivElement>(null);

  const [preset, setPreset] = useState<VetReportDatePreset>('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [sections, setSections] = useState<VetReportSections>({
    abnormal: true,
    weight: true,
    photos: true,
    notes: true,
    ai: true,
  });
  const [report, setReport] = useState<VetReportPayload | null>(null);
  const [aiSummary, setAiSummary] = useState<VetReportAiSummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [rangeClamped, setRangeClamped] = useState(false);

  const selectedCat = cats.find((c) => c.id === selectedCatId) ?? cats[0];

  const toProfile = useCallback(
    (c: CatRow): VetReportCatProfile => ({
      id: c.id,
      name: c.name,
      emoji: c.emoji,
      birthday: c.birthday ?? '',
      gender: c.gender ?? '',
      breed: c.breed ?? '',
      chronicNote: c.chronicNote ?? '',
      allergyNote: c.allergyNote ?? '',
      vetClinic: c.vetClinic ?? '',
      profileNote: c.profileNote ?? '',
    }),
    []
  );

  const buildReportNow = useCallback(() => {
    if (!selectedCat) return;
    let { start, end } = computeVetReportDateRange(preset, today, customStart, customEnd);
    const clamped = clampRangeForFree(start, end, today, isPro);
    start = clamped.start;
    end = clamped.end;
    setRangeClamped(clamped.clamped);
    const payload = buildVetReport(toProfile(selectedCat), start, end, sections, lang);
    setReport(payload);
    setAiSummary(null);
    setAiErr(null);
  }, [selectedCat, preset, today, customStart, customEnd, isPro, sections, lang, toProfile]);

  const runAiSummary = useCallback(async () => {
    if (!report || !selectedCat) return;
    if (!canUseVetAiSummary(today, appPlan)) {
      setAiErr(t.aiLimit);
      return;
    }
    setAiLoading(true);
    setAiErr(null);
    try {
      const ctx = buildVetReportContextText(report, sections, lang);
      const summary = await generateVetReportAiSummary(lang, ctx, {
        clientId,
        catId: selectedCat.id,
        usageDate: today,
        plan: appPlan,
      });
      setAiSummary(summary);
      if (!isPro) recordVetAiUsedToday(today);
    } catch (e) {
      if (e instanceof VetReportApiError) {
        setAiErr(e.message);
      } else {
        setAiErr(lang === 'zh' ? 'AI 重點整理暫時無法使用，請稍後再試。' : 'AI summary is temporarily unavailable. Please try again later.');
      }
    } finally {
      setAiLoading(false);
    }
  }, [report, selectedCat, sections, lang, clientId, today, appPlan, isPro, t.aiLimit]);

  const reportPlainText = useMemo(() => {
    if (!report) return '';
    const lines: string[] = [];
    lines.push(`${t.title} — ${report.cat.name}`);
    lines.push(`${report.startDate} — ${report.endDate}`);
    lines.push('');
    if (report.abnormalBullets.length) {
      lines.push(`【${t.abnormalSummary}】`);
      report.abnormalBullets.forEach((b) => lines.push(`• ${b}`));
    }
    if (report.timeline.length) {
      lines.push(`【${t.timeline}】`);
      for (const row of report.timeline) {
        lines.push(`${row.date}: ${row.lines.join('；')}`);
      }
    }
    if (aiSummary) {
      lines.push(`【${t.aiSection}】`);
      lines.push(`${t.watchItems}: ${aiSummary.watchItems}`);
      lines.push(`${t.observe}: ${aiSummary.observeDirections}`);
      lines.push(`${t.vetHandoff}: ${aiSummary.vetHandoff}`);
    }
    lines.push(t.disclaimer);
    return lines.join('\n');
  }, [report, aiSummary, t]);

  const weightSpark = report?.weights.map((w) => ({ date: w.date, weight: w.weight })) ?? [];
  const latestW = report?.weights[0];
  const oldestW = report?.weights[report.weights.length - 1];
  const weightDelta =
    latestW && oldestW && latestW.date !== oldestW.date ? latestW.weight - oldestW.weight : 0;

  const showFreeLock = !isPro && report != null;

  return (
    <>
      {catSwitcher}

      <header className="mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 p-5 text-white shadow-lg">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-orange-300/90">Vet handoff</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-300">{t.lead}</p>
        {!isPro ? (
          <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs leading-snug text-stone-200">{t.freeBanner}</p>
        ) : (
          <span className="mt-3 inline-block rounded-full bg-orange-400/90 px-2.5 py-0.5 text-[10px] font-bold">
            {t.proBadge}
          </span>
        )}
      </header>

      <section className="mb-4 space-y-3 rounded-3xl border border-stone-100 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-bold text-stone-500">{t.cat}</label>
          <select
            value={selectedCatId}
            onChange={(e) => onSelectCatId(e.target.value)}
            className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm outline-none focus:border-orange-300"
          >
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-bold text-stone-500">{t.range}</p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['7d', t.preset7],
                ['30d', t.preset30],
                ['custom', t.presetCustom],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                disabled={!isPro && id !== '7d'}
                onClick={() => setPreset(id)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                  preset === id ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
                } ${!isPro && id !== '7d' ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
          {preset === 'custom' ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="date"
                value={customStart}
                max={today}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-xl border border-stone-200 px-2 py-1.5 text-xs"
              />
              <input
                type="date"
                value={customEnd}
                max={today}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-xl border border-stone-200 px-2 py-1.5 text-xs"
              />
            </div>
          ) : null}
          {rangeClamped ? (
            <p className="mt-2 text-[11px] text-amber-700">{t.freeBanner}</p>
          ) : null}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-bold text-stone-500">{t.sections}</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['abnormal', t.secAbnormal],
                ['weight', t.secWeight],
                ['photos', t.secPhotos],
                ['notes', t.secNotes],
                ['ai', t.secAi],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-medium text-stone-700"
              >
                <input
                  type="checkbox"
                  checked={sections[key]}
                  onChange={(e) => setSections((s) => ({ ...s, [key]: e.target.checked }))}
                  className="rounded border-stone-300 text-orange-500"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={buildReportNow}
          className="w-full rounded-2xl bg-orange-500 py-3 text-sm font-bold text-white shadow-md shadow-orange-200/40"
        >
          {t.generate}
        </button>
      </section>

      {report ? (
        <div className="relative">
          <div
            ref={reportRef}
            id="vet-report-print-root"
            className={`space-y-4 rounded-3xl border border-stone-100 bg-[#fafaf9] p-4 shadow-sm print:border-0 print:shadow-none ${showFreeLock ? 'max-h-[520px] overflow-hidden' : ''}`}
          >
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                {report.startDate} — {report.endDate}
              </p>
              <h2 className="mt-1 flex items-center gap-2 text-lg font-bold text-stone-900">
                <span>{report.cat.emoji}</span>
                {report.cat.name}
              </h2>
            </div>

            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-stone-800">{t.profile}</h3>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[13px] text-stone-600">
                <div>
                  <dt className="text-[10px] font-bold text-stone-400">{t.name}</dt>
                  <dd>{report.cat.name}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold text-stone-400">{t.age}</dt>
                  <dd>
                    {calculateAgeText(report.cat.birthday, lang, t.yearsOld, t.unknown)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold text-stone-400">{t.breed}</dt>
                  <dd>{report.cat.breed || t.unknown}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold text-stone-400">{t.gender}</dt>
                  <dd>{report.cat.gender || t.unknown}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[10px] font-bold text-stone-400">{t.chronic}</dt>
                  <dd>{report.cat.chronicNote || t.unknown}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[10px] font-bold text-stone-400">{t.allergy}</dt>
                  <dd>{report.cat.allergyNote || t.unknown}</dd>
                </div>
              </dl>
            </section>

            {sections.abnormal ? (
              <section className="rounded-2xl bg-white p-4 shadow-sm">
                <h3 className="mb-2 text-sm font-bold text-red-800">{t.abnormalSummary}</h3>
                {report.abnormalBullets.length ? (
                  <ul className="list-inside list-disc space-y-1 text-[13px] text-stone-700">
                    {report.abnormalBullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-stone-500">{t.noAbnormal}</p>
                )}
              </section>
            ) : null}

            {sections.weight ? (
              <section className="rounded-2xl bg-white p-4 shadow-sm">
                <h3 className="mb-2 text-sm font-bold text-stone-800">{t.weightTrend}</h3>
                {report.weights.length ? (
                  <>
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-orange-50 p-3">
                        <p className="text-[10px] font-bold text-orange-700">{t.latestWeight}</p>
                        <p className="text-lg font-bold text-orange-800">
                          {latestW?.weight} kg
                        </p>
                        <p className="text-[10px] text-stone-500">{latestW?.date}</p>
                      </div>
                      <div className="rounded-xl bg-stone-50 p-3">
                        <p className="text-[10px] font-bold text-stone-500">{t.weightChange}</p>
                        <p className="text-lg font-bold text-stone-800">
                          {report.weights.length >= 2
                            ? `${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(2)} kg`
                            : '—'}
                        </p>
                      </div>
                    </div>
                    <WeightSparkline points={weightSpark} />
                  </>
                ) : (
                  <p className="text-sm text-stone-500">{t.noWeight}</p>
                )}
              </section>
            ) : null}

            {sections.abnormal || sections.notes ? (
              <section className="rounded-2xl bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-bold text-stone-800">{t.timeline}</h3>
                {report.timeline.length ? (
                  <ul className="space-y-3 border-l-2 border-orange-200 pl-3">
                    {report.timeline.map((row) => (
                      <li key={row.date}>
                        <p className="text-xs font-bold text-orange-700">
                          {formatDisplayDate(row.date, lang)}
                        </p>
                        {row.lines.map((line, i) => (
                          <p key={i} className="mt-0.5 text-[13px] leading-snug text-stone-700">
                            {line}
                          </p>
                        ))}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-stone-500">{t.noTimeline}</p>
                )}
              </section>
            ) : null}

            {sections.photos ? (
              <section className="rounded-2xl bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-bold text-stone-800">{t.photos}</h3>
                {report.photos.length ? (
                  <div className="space-y-4">
                    {report.photos.map((g) => (
                      <div key={g.date}>
                        <p className="mb-2 text-xs font-bold text-stone-500">{g.date}</p>
                        <div className="grid grid-cols-3 gap-2">
                          {[...g.abnormalPhotos, ...g.dailyPhotos].map((src, i) => (
                            <button
                              key={`${g.date}-${i}`}
                              type="button"
                              onClick={() => onOpenPhoto(src)}
                              className="aspect-square overflow-hidden rounded-xl bg-stone-100"
                            >
                              <img src={src} alt="" className="h-full w-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-stone-500">{t.noPhotos}</p>
                )}
              </section>
            ) : null}

            {sections.ai && aiSummary ? (
              <section className="rounded-2xl border border-violet-100 bg-gradient-to-b from-violet-50/80 to-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-bold text-violet-900">{t.aiSection}</h3>
                <div className="space-y-3 text-[13px] leading-relaxed text-stone-700">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-violet-600">{t.watchItems}</p>
                    <p className="whitespace-pre-wrap">{aiSummary.watchItems}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-violet-600">{t.observe}</p>
                    <p className="whitespace-pre-wrap">{aiSummary.observeDirections}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-violet-600">{t.vetHandoff}</p>
                    <p className="whitespace-pre-wrap">{aiSummary.vetHandoff}</p>
                  </div>
                </div>
              </section>
            ) : null}

            <p className="text-center text-[10px] leading-snug text-stone-400">{t.disclaimer}</p>
          </div>

          {showFreeLock ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center justify-end bg-gradient-to-t from-[#fafaf9] via-[#fafaf9]/95 to-transparent pb-6 pt-24">
              <p className="pointer-events-auto mb-2 max-w-xs text-center text-sm font-semibold text-stone-800">
                {t.previewLocked}
              </p>
              <button
                type="button"
                onClick={onGoSettings}
                className="pointer-events-auto rounded-full bg-orange-500 px-5 py-2 text-sm font-bold text-white shadow-lg"
              >
                {t.upgrade}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {report && !showFreeLock ? (
        <section className="mb-6 space-y-2">
          {sections.ai ? (
            <button
              type="button"
              disabled={aiLoading || !canUseVetAiSummary(today, appPlan)}
              onClick={() => void runAiSummary()}
              className="w-full rounded-2xl border border-violet-200 bg-violet-50 py-3 text-sm font-bold text-violet-800 disabled:opacity-50"
            >
              {aiLoading ? t.aiBusy : t.aiBtn}
            </button>
          ) : null}
          {aiErr ? <p className="text-xs text-red-700">{aiErr}</p> : null}

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={!canExportVetPdf(appPlan)}
              onClick={async () => {
                if (!reportRef.current) return;
                if (!canExportVetPdf(appPlan)) {
                  setExportMsg(t.exportProOnly);
                  return;
                }
                await exportReportElementAsPdf(
                  reportRef.current,
                  `vet-report-${report.cat.name}-${report.endDate}.pdf`
                );
              }}
              className="rounded-xl bg-stone-900 py-2.5 text-xs font-bold text-white disabled:opacity-45"
            >
              {t.exportPdf}
            </button>
            <button
              type="button"
              disabled={!canExportVetPdf(appPlan)}
              onClick={async () => {
                if (!reportRef.current) return;
                if (!canExportVetPdf(appPlan)) {
                  setExportMsg(t.exportProOnly);
                  return;
                }
                await exportReportElementAsPng(
                  reportRef.current,
                  `vet-report-${report.cat.name}-${report.endDate}.png`
                );
              }}
              className="rounded-xl border border-stone-300 bg-white py-2.5 text-xs font-bold text-stone-700 disabled:opacity-45"
            >
              {t.exportPng}
            </button>
            <button
              type="button"
              onClick={async () => {
                const ok = await shareReportText(`${t.title} — ${report.cat.name}`, reportPlainText);
                setExportMsg(ok ? t.sharedOk : t.shareFail);
              }}
              className="rounded-xl border border-orange-200 bg-orange-50 py-2.5 text-xs font-bold text-orange-800"
            >
              {t.share}
            </button>
          </div>
          {exportMsg ? <p className="text-center text-xs text-stone-500">{exportMsg}</p> : null}
        </section>
      ) : null}

      {report && showFreeLock ? (
        <section className="mb-6 grid grid-cols-2 gap-2 opacity-60">
          <button type="button" disabled className="rounded-xl bg-stone-200 py-2.5 text-xs font-bold text-stone-500">
            {t.exportPdf}
          </button>
          <button
            type="button"
            onClick={onGoSettings}
            className="col-span-2 rounded-xl bg-orange-500 py-2.5 text-xs font-bold text-white"
          >
            {t.upgrade}
          </button>
        </section>
      ) : null}
    </>
  );
}
