import {
  WEEKLY_MIN_CARE_ENTRIES,
  WEEKLY_MIN_DAYS_WITH_RECORDS,
  type WeeklyReportDataAssessment,
} from '../weeklyReportEligibility';

type Props = {
  title: string;
  reqDays: string;
  reqEntries: string;
  reqAbnormal: string;
  ctaLabel: string;
  onCta: () => void;
  className?: string;
  assessment?: WeeklyReportDataAssessment;
};

export function AiInsufficientDataPanel({
  title,
  reqDays,
  reqEntries,
  reqAbnormal,
  ctaLabel,
  onCta,
  className = 'mt-4',
  assessment,
}: Props) {
  return (
    <div
      className={`${className} animate-fade-in space-y-3 rounded-2xl border border-amber-100 bg-amber-50/50 px-4 py-5 text-center`}
    >
      <p className="text-[14px] leading-relaxed text-stone-800">{title}</p>
      <ul className="mx-auto max-w-sm space-y-1.5 text-left text-[13px] leading-snug text-stone-600">
        <li className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 text-amber-600" aria-hidden>
            •
          </span>
          <span>{reqDays}</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 text-amber-600" aria-hidden>
            •
          </span>
          <span>{reqEntries}</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 text-amber-600" aria-hidden>
            •
          </span>
          <span>{reqAbnormal}</span>
        </li>
      </ul>
      {assessment ? (
        <p className="text-[12px] text-stone-500">
          {assessment.daysWithRecords}/{WEEKLY_MIN_DAYS_WITH_RECORDS} · {assessment.careEntryCount}/
          {WEEKLY_MIN_CARE_ENTRIES}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onCta}
        className="w-full rounded-2xl bg-white py-2.5 text-[13px] font-bold text-amber-900 shadow-sm ring-1 ring-amber-200 transition active:scale-[0.99]"
      >
        {ctaLabel}
      </button>
    </div>
  );
}
