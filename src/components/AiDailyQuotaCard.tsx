import { Sparkles } from 'lucide-react';
import { formatAiQuotaDisplay } from '../aiClient';

type Lang = 'zh' | 'en';
type AppPlan = 'free' | 'pro';

type QuotaUiState = 'normal' | 'lastOne' | 'lowPro' | 'exhausted';

const copy: Record<
  Lang,
  {
    title: string;
    remaining: (n: number) => string;
    lastOne: string;
    lowPro: string;
    exhausted: string;
    upgrade: string;
    proExhausted: string;
  }
> = {
  zh: {
    title: '今日 AI 次數',
    remaining: (n) => `今日還可使用 ${n} 次 AI`,
    lastOne: '剩最後 1 次 AI',
    lowPro: '剩餘 AI 次數不多',
    exhausted: '今日 AI 次數已用完',
    upgrade: '升級 Pro',
    proExhausted: 'Pro 今日 30 次已用完，請明日再試',
  },
  en: {
    title: "Today's AI uses",
    remaining: (n) => `${n} AI use${n === 1 ? '' : 's'} left today`,
    lastOne: 'Last AI use today',
    lowPro: 'AI uses running low',
    exhausted: "Today's AI quota is used up",
    upgrade: 'Upgrade to Pro',
    proExhausted: 'All 30 Pro uses are used today. Try again tomorrow.',
  },
};

function resolveQuotaUiState(plan: AppPlan, displayUsed: number, displayLimit: number): QuotaUiState {
  const remaining = Math.max(0, displayLimit - displayUsed);
  if (remaining <= 0) return 'exhausted';
  if (plan === 'free' && remaining === 1) return 'lastOne';
  if (plan === 'pro' && remaining <= 5) return 'lowPro';
  return 'normal';
}

export type AiDailyQuotaCardProps = {
  lang: Lang;
  plan: AppPlan;
  used: number;
  limit: number;
  className?: string;
  /** Smaller padding for vet report etc. */
  compact?: boolean;
  title?: string;
  upgradeLabel?: string;
  /** Free plan exhausted: opens premium upgrade flow */
  onUpgrade?: () => void;
};

export function AiDailyQuotaCard({
  lang,
  plan,
  used,
  limit,
  className = '',
  compact = false,
  title,
  upgradeLabel,
  onUpgrade,
}: AiDailyQuotaCardProps) {
  const t = copy[lang];
  const { displayUsed, displayLimit } = formatAiQuotaDisplay(used, limit);
  if (displayLimit <= 0) return null;

  const remaining = Math.max(0, displayLimit - displayUsed);
  const uiState = resolveQuotaUiState(plan, displayUsed, displayLimit);
  const progressPct = displayLimit > 0 ? Math.min(100, (displayUsed / displayLimit) * 100) : 0;

  const cardTone =
    uiState === 'exhausted'
      ? 'border-red-200/90 bg-gradient-to-br from-red-50/50 via-white to-orange-50/40'
      : uiState === 'lastOne'
        ? 'border-orange-300/90 bg-gradient-to-br from-orange-50/80 via-white to-amber-50/50 ai-quota-attention'
        : 'border-orange-100/90 bg-white';

  const usedColor =
    uiState === 'exhausted'
      ? 'text-red-600'
      : uiState === 'lastOne'
        ? 'text-orange-600'
        : 'text-orange-600';

  const limitColor = uiState === 'exhausted' ? 'text-red-400' : 'text-stone-400';

  const barTrack = uiState === 'exhausted' ? 'bg-red-100/80' : 'bg-orange-100/70';

  const barFill =
    uiState === 'exhausted'
      ? 'bg-gradient-to-r from-red-400 to-orange-500'
      : uiState === 'lastOne'
        ? 'bg-gradient-to-r from-orange-400 to-orange-500 ai-quota-bar-pulse'
        : 'bg-gradient-to-r from-orange-300 to-orange-400';

  const hintText = (() => {
    if (uiState === 'exhausted') return plan === 'pro' ? t.proExhausted : t.exhausted;
    if (uiState === 'lastOne') return t.lastOne;
    if (uiState === 'lowPro') return t.lowPro;
    return t.remaining(remaining);
  })();

  const hintClass =
    uiState === 'exhausted'
      ? 'text-red-800/90 font-medium'
      : uiState === 'lastOne'
        ? 'text-orange-800 font-semibold'
        : uiState === 'lowPro'
          ? 'text-amber-800/90 font-medium'
          : 'text-stone-500';

  return (
    <section
      className={`overflow-hidden rounded-2xl border shadow-sm transition-shadow ${cardTone} ${
        compact ? 'px-3 py-2.5' : 'px-4 py-3.5'
      } ${className}`}
      aria-label={title ?? t.title}
    >
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-100 to-amber-50 text-orange-600 shadow-inner ${
              compact ? 'h-8 w-8' : 'h-9 w-9'
            }`}
            aria-hidden
          >
            <Sparkles className={compact ? 'h-4 w-4' : 'h-[18px] w-[18px]'} strokeWidth={2.2} />
          </span>
          <p className={`font-semibold text-stone-900 ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
            {title ?? t.title}
          </p>
        </div>
        <p className={`shrink-0 tabular-nums leading-none ${compact ? 'text-lg' : 'text-xl'} font-bold`}>
          <span className={usedColor}>{displayUsed}</span>
          <span className={`mx-0.5 font-normal ${limitColor}`}>/</span>
          <span className={uiState === 'exhausted' ? 'text-red-500/80' : 'text-stone-500'}>{displayLimit}</span>
        </p>
      </div>

      <div className={`relative overflow-hidden rounded-full ${barTrack} ${compact ? 'h-1.5' : 'h-2'}`}>
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out ${barFill}`}
          style={{ width: `${progressPct}%` }}
          role="progressbar"
          aria-valuenow={displayUsed}
          aria-valuemin={0}
          aria-valuemax={displayLimit}
        />
      </div>

      <p className={`mt-2 leading-snug ${hintClass} ${compact ? 'text-[11px]' : 'text-[12px]'}`}>{hintText}</p>

      {uiState === 'exhausted' && plan === 'free' && onUpgrade ? (
        <button
          type="button"
          onClick={onUpgrade}
          className={`mt-3 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 font-bold text-white shadow-md shadow-orange-300/35 transition active:scale-[0.99] ${
            compact ? 'py-2 text-[12px]' : 'py-2.5 text-[13px]'
          }`}
        >
          {upgradeLabel ?? t.upgrade}
        </button>
      ) : null}
    </section>
  );
}
