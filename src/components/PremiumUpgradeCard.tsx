import { Crown } from 'lucide-react';
import { premiumUpsellCopy, type PremiumUpsellReason } from './PremiumUpsellSheet';

type Lang = 'zh' | 'en';

export type PremiumUpgradeCardProps = {
  lang: Lang;
  reason?: PremiumUpsellReason;
  /** e.g. 今日 AI 次數已用完 */
  headline: string;
  /** Free: show Pro CTA; Pro exhausted: hide upgrade button */
  showUpgrade?: boolean;
  upgradeLabel: string;
  onUpgrade: () => void;
  /** Shown when `showUpgrade` is false (Pro daily cap reached). */
  proExhaustedHint?: string;
  className?: string;
};

export function PremiumUpgradeCard({
  lang,
  reason = 'ai',
  headline,
  showUpgrade = true,
  upgradeLabel,
  onUpgrade,
  proExhaustedHint,
  className = '',
}: PremiumUpgradeCardProps) {
  const t = premiumUpsellCopy[lang];
  const sub = t.subtitle[reason] ?? t.subtitle.general;

  return (
    <section
      className={`overflow-hidden rounded-3xl border border-amber-200/80 bg-gradient-to-b from-amber-50/95 via-white to-orange-50/90 p-4 shadow-[0_12px_40px_-18px_rgba(234,88,12,0.35)] ${className}`}
      aria-labelledby="premium-upgrade-card-title"
    >
      <div id="premium-upgrade-card-title" className="mb-2 flex items-center gap-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-md">
          <Crown className="h-5 w-5" strokeWidth={2.2} aria-hidden />
        </span>
        <div>
          <p className="text-[15px] font-bold leading-snug text-stone-900">{headline}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-stone-600">{sub}</p>
        </div>
      </div>

      {showUpgrade ? (
        <>
          <ul className="mt-3 space-y-1.5 rounded-2xl border border-orange-100/80 bg-white/70 px-3.5 py-2.5">
            {t.bullets.slice(0, 4).map((line) => (
              <li key={line} className="flex gap-2 text-[12px] leading-snug text-stone-800">
                <Crown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" strokeWidth={2.5} aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col items-center gap-0.5 rounded-2xl border border-amber-200/70 bg-amber-50/50 px-3 py-2.5">
            <p className="text-[14px] font-bold text-stone-900">{t.priceMonthly}</p>
            <p className="text-[13px] font-bold text-stone-800">{t.priceYearly}</p>
            <p className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold text-orange-800">
              {t.yearlySave}
            </p>
            <p className="mt-1 text-center text-[10px] leading-snug text-stone-500">{t.appStoreNote}</p>
          </div>
          <button
            type="button"
            onClick={onUpgrade}
            className="mt-3 w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-orange-300/40 transition active:scale-[0.99]"
          >
            {upgradeLabel}
          </button>
        </>
      ) : proExhaustedHint ? (
        <p className="mt-2 text-[12px] leading-relaxed text-stone-600">{proExhaustedHint}</p>
      ) : null}
    </section>
  );
}
