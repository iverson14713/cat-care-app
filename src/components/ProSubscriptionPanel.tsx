import { Crown, Lock } from 'lucide-react';
import { useState } from 'react';
import { SUBSCRIPTION_PRICING } from '../subscription/constants';
import type { BillingPeriod, SubscriptionStatus } from '../subscription/types';

type Lang = 'zh' | 'en';

const copy = {
  zh: {
    section: '訂閱方案',
    paymentNote: '正式上架後將透過 App Store 訂閱結帳',
    testNote: '目前為測試版：升級不會實際扣款，僅在本機開通 Pro 體驗。',
    current: '目前方案',
    free: '免費版',
    pro: 'Pro',
    monthly: SUBSCRIPTION_PRICING.monthly.labelZh,
    yearly: SUBSCRIPTION_PRICING.yearly.labelZh,
    yearlySave: SUBSCRIPTION_PRICING.yearlySaveZh,
    upgrade: '升級 Pro（測試開通）',
    downgrade: '切回免費版',
    restore: '恢復購買',
    restoring: '恢復中…',
    selectPlan: '選擇方案',
    monthlyLabel: '月訂閱',
    yearlyLabel: '年訂閱',
  },
  en: {
    section: 'Subscription',
    paymentNote: 'After launch, billing goes through the App Store',
    testNote: 'Test build: upgrade does not charge — unlocks Pro on this device only.',
    current: 'Current plan',
    free: 'Free',
    pro: 'Pro',
    monthly: SUBSCRIPTION_PRICING.monthly.labelEn,
    yearly: SUBSCRIPTION_PRICING.yearly.labelEn,
    yearlySave: SUBSCRIPTION_PRICING.yearlySaveEn,
    upgrade: 'Upgrade to Pro (test)',
    downgrade: 'Switch to Free',
    restore: 'Restore purchases',
    restoring: 'Restoring…',
    selectPlan: 'Choose a plan',
    monthlyLabel: 'Monthly',
    yearlyLabel: 'Yearly',
  },
} as const;

export type ProSubscriptionPanelProps = {
  lang: Lang;
  status: SubscriptionStatus;
  busy?: boolean;
  onUpgrade: (period: BillingPeriod) => void;
  onDowngrade: () => void;
  onRestore: () => void;
  compact?: boolean;
};

export function ProSubscriptionPanel({
  lang,
  status,
  busy = false,
  onUpgrade,
  onDowngrade,
  onRestore,
  compact = false,
}: ProSubscriptionPanelProps) {
  const t = copy[lang];
  const [period, setPeriod] = useState<BillingPeriod>('yearly');

  return (
    <section
      className={`overflow-hidden rounded-3xl border border-amber-200/80 bg-gradient-to-b from-amber-50/95 via-white to-orange-50/90 shadow-[0_12px_40px_-18px_rgba(234,88,12,0.35)] ${
        compact ? 'p-4' : 'p-5'
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-md">
          <Crown className="h-5 w-5" strokeWidth={2.2} aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-bold text-stone-900">{t.section}</h2>
          <p className="text-[11px] text-stone-500">{t.paymentNote}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-inner">
        <p className="text-sm text-stone-700">
          {t.current}：
          <span className="font-bold text-orange-600">
            {status === 'pro' ? (
              <span className="inline-flex items-center gap-1">
                <Crown className="inline h-3.5 w-3.5 text-amber-500" aria-hidden />
                {t.pro}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Lock className="inline h-3.5 w-3.5 text-stone-400" aria-hidden />
                {t.free}
              </span>
            )}
          </span>
        </p>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-stone-600">{t.testNote}</p>

      {status === 'free' ? (
        <>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-stone-500">{t.selectPlan}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(['monthly', 'yearly'] as const).map((p) => (
              <button
                key={p}
                type="button"
                disabled={busy}
                onClick={() => setPeriod(p)}
                className={`rounded-2xl border px-3 py-3 text-left transition active:scale-[0.99] ${
                  period === p
                    ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-200'
                    : 'border-stone-200 bg-white hover:border-orange-200'
                }`}
              >
                <span className="block text-[11px] font-bold text-stone-500">
                  {p === 'monthly' ? t.monthlyLabel : t.yearlyLabel}
                </span>
                <span className="mt-1 block text-sm font-bold text-stone-900">
                  {p === 'monthly' ? t.monthly : t.yearly}
                </span>
                {p === 'yearly' ? (
                  <span className="mt-1 inline-block rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold text-orange-800">
                    {t.yearlySave}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => onUpgrade(period)}
            className="mt-4 w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-orange-300/40 transition active:scale-[0.99] disabled:opacity-60"
          >
            {t.upgrade}
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onDowngrade}
          className="mt-4 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold text-stone-700 transition active:scale-[0.99] disabled:opacity-60"
        >
          {t.downgrade}
        </button>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={onRestore}
        className="mt-2 w-full rounded-2xl border border-orange-200 bg-orange-50/80 py-3 text-sm font-bold text-orange-800 transition hover:bg-orange-50 active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? t.restoring : t.restore}
      </button>
    </section>
  );
}
