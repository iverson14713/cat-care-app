import { Crown } from 'lucide-react';
import { useState } from 'react';
import { SUBSCRIPTION_PRICING } from '../subscription/constants';
import type { BillingPeriod } from '../subscription/types';

export type PremiumUpsellReason =
  | 'ai'
  | 'reminders'
  | 'pets'
  | 'weekly'
  | 'history'
  | 'pdf'
  | 'photos'
  | 'general';

type Lang = 'zh' | 'en';

export const premiumUpsellCopy: Record<
  Lang,
  {
    title: string;
    bullets: string[];
    priceMonthly: string;
    priceYearly: string;
    yearlySave: string;
    later: string;
    upgrade: string;
    restore: string;
    restoring: string;
    appStoreNote: string;
    testNote: string;
    subtitle: Record<PremiumUpsellReason, string>;
  }
> = {
  zh: {
    title: '🐾 升級 Pro 解鎖完整照護',
    bullets: [
      '每日 30 次 AI（整理重點、照護助理、週報與隨口問共用）',
      'AI 週報',
      '無限提醒',
      '多寵物管理',
      '完整歷史搜尋',
      'PDF 獸醫報告',
      '更多照片空間',
    ],
    priceMonthly: SUBSCRIPTION_PRICING.monthly.labelZh,
    priceYearly: SUBSCRIPTION_PRICING.yearly.labelZh,
    yearlySave: SUBSCRIPTION_PRICING.yearlySaveZh,
    later: '稍後再說',
    upgrade: '升級 Pro（測試開通）',
    restore: '恢復購買',
    restoring: '恢復中…',
    appStoreNote: '正式上架後將透過 App Store 訂閱結帳。',
    testNote: '目前不會實際扣款，僅在本機開通 Pro 體驗。',
    subtitle: {
      ai: '今日 AI 次數已用完，升級後可獲得更多照護建議。',
      reminders: '提醒數量已達免費版上限。',
      pets: '寵物數量已達免費版上限（最多 3 隻）。',
      weekly: 'AI 正式週報為 Pro 專屬功能。',
      history: '完整關鍵字與進階篩選為 Pro；免費版可使用「最近 7 天／30 天／本月」日期篩選。',
      pdf: 'PDF 匯出為 Pro 功能。',
      photos: '每日照片已達免費版上限，升級可上傳更多張。',
      general: '此功能需要 Pro，升級即可解鎖。',
    },
  },
  en: {
    title: '🐾 Upgrade to Pro',
    bullets: [
      '30 shared AI uses/day (vet highlights, assistant, weekly, Q&A)',
      'AI weekly report',
      'Unlimited reminders',
      'Unlimited pets',
      'Full history search',
      'PDF vet report',
      'More photo slots per day',
    ],
    priceMonthly: SUBSCRIPTION_PRICING.monthly.labelEn,
    priceYearly: SUBSCRIPTION_PRICING.yearly.labelEn,
    yearlySave: SUBSCRIPTION_PRICING.yearlySaveEn,
    later: 'Not now',
    upgrade: 'Upgrade to Pro (test)',
    restore: 'Restore purchases',
    restoring: 'Restoring…',
    appStoreNote: 'After launch, billing will go through the App Store.',
    testNote: 'No charge in this build — test unlock on this device only.',
    subtitle: {
      ai: "You've used today's AI quota on the free plan.",
      reminders: "You've reached the free reminder limit.",
      pets: 'Free plan supports up to 3 pets.',
      weekly: 'The full AI weekly report is a Pro feature.',
      history: 'Full keyword search and advanced filters are Pro; free plan uses quick date ranges (7 / 30 days / this month).',
      pdf: 'PDF export is a Pro feature.',
      photos: "You've reached the free daily photo limit.",
      general: 'This feature requires Pro.',
    },
  },
};

export type PremiumUpsellSheetProps = {
  open: boolean;
  lang: Lang;
  reason: PremiumUpsellReason;
  busy?: boolean;
  onClose: () => void;
  onUpgrade: (period: BillingPeriod) => void;
  onRestore: () => void;
};

export function PremiumUpsellSheet({
  open,
  lang,
  reason,
  busy = false,
  onClose,
  onUpgrade,
  onRestore,
}: PremiumUpsellSheetProps) {
  const [period, setPeriod] = useState<BillingPeriod>('yearly');
  if (!open) return null;
  const t = premiumUpsellCopy[lang];
  const sub = t.subtitle[reason] ?? t.subtitle.general;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-10 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-upsell-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-t-[1.35rem] border border-white/60 bg-gradient-to-b from-white/95 to-orange-50/95 shadow-[0_-8px_40px_-12px_rgba(234,88,12,0.35)]"
        style={{ animation: 'premiumSheetIn 0.28s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-stone-300/80" aria-hidden />
        <div className="max-h-[min(85vh,640px)] overflow-y-auto px-5 pb-5 pt-3">
          <h2 id="premium-upsell-title" className="flex items-center justify-center gap-2 text-center text-lg font-bold tracking-tight text-stone-900">
            <Crown className="h-5 w-5 shrink-0 text-amber-500" strokeWidth={2.2} aria-hidden />
            {t.title}
          </h2>
          <p className="mt-2 text-center text-[13px] leading-snug text-stone-600">{sub}</p>

          <ul className="mt-4 space-y-2 rounded-2xl border border-orange-100/80 bg-white/70 px-4 py-3">
            {t.bullets.map((line) => (
              <li key={line} className="flex gap-2 text-[14px] leading-snug text-stone-800">
                <span className="shrink-0 font-semibold text-amber-500" aria-hidden>
                  <Crown className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {(['monthly', 'yearly'] as const).map((p) => (
              <button
                key={p}
                type="button"
                disabled={busy}
                onClick={() => setPeriod(p)}
                className={`rounded-2xl border px-3 py-2.5 text-center transition active:scale-[0.99] ${
                  period === p
                    ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-200'
                    : 'border-stone-200 bg-white'
                }`}
              >
                <p className="text-sm font-bold text-stone-900">{p === 'monthly' ? t.priceMonthly : t.priceYearly}</p>
                {p === 'yearly' ? (
                  <p className="mt-1 text-[10px] font-semibold text-orange-800">{t.yearlySave}</p>
                ) : null}
              </button>
            ))}
          </div>

          <p className="mt-3 text-center text-[11px] leading-snug text-stone-600">{t.appStoreNote}</p>
          <p className="mt-1 text-center text-[10px] leading-snug text-stone-500">{t.testNote}</p>

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onUpgrade(period)}
              className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-[15px] font-bold text-white shadow-md shadow-orange-300/40 transition active:scale-[0.99] disabled:opacity-60"
            >
              {t.upgrade}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onRestore}
              className="w-full rounded-2xl border border-orange-200 bg-orange-50 py-3 text-[14px] font-bold text-orange-800 transition active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? t.restoring : t.restore}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="w-full rounded-2xl border border-stone-200 bg-white/90 py-3 text-[15px] font-semibold text-stone-700 transition hover:bg-stone-50 active:scale-[0.99]"
            >
              {t.later}
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes premiumSheetIn {
          from { transform: translateY(100%); opacity: 0.65; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
