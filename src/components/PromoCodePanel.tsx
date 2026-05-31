import { useState } from 'react';
import { isPromoProActive } from '../supabasePromo';

type Lang = 'zh' | 'en';

const copy = {
  zh: {
    title: '推廣碼 / 兌換碼',
    hint: '輸入活動、合作或寵物展提供的兌換碼，可開通 Pro 體驗或加贈 AI 次數。',
    placeholder: '輸入推廣碼',
    redeem: '兌換',
    redeeming: '兌換中…',
    signInHint: '請先登入帳號後再兌換推廣碼。',
    activeUntil: '活動 Pro 到期日',
    aiBonus: '今日 AI 加贈',
    lastCode: '最近兌換',
  },
  en: {
    title: 'Promo / redemption code',
    hint: 'Enter a campaign code to unlock Pro trial access or extra AI uses.',
    placeholder: 'Enter promo code',
    redeem: 'Redeem',
    redeeming: 'Redeeming…',
    signInHint: 'Sign in to redeem a promo code.',
    activeUntil: 'Promo Pro until',
    aiBonus: 'Extra AI uses today',
    lastCode: 'Last redeemed',
  },
} as const;

export type PromoCodePanelProps = {
  lang: Lang;
  isLoggedIn: boolean;
  busy?: boolean;
  promoProUntil?: string | null;
  promoAiBonus?: number;
  redeemedCode?: string | null;
  onRedeem: (code: string) => void | Promise<void>;
};

export function PromoCodePanel({
  lang,
  isLoggedIn,
  busy = false,
  promoProUntil = null,
  promoAiBonus = 0,
  redeemedCode = null,
  onRedeem,
}: PromoCodePanelProps) {
  const t = copy[lang];
  const [code, setCode] = useState('');
  const promoActive = isPromoProActive(promoProUntil);

  return (
    <section className="mb-4 overflow-hidden rounded-3xl border border-orange-100 bg-gradient-to-b from-orange-50/80 via-white to-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-stone-900">{t.title}</h2>
      <p className="mt-1 text-[12px] leading-snug text-stone-500">{t.hint}</p>

      {!isLoggedIn ? (
        <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2.5 text-[12px] font-medium text-amber-900">
          {t.signInHint}
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t.placeholder}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy}
            className="min-w-0 flex-1 rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm font-semibold tracking-wide text-stone-900 outline-none ring-orange-300/40 focus:border-orange-300 focus:ring-2 disabled:opacity-60"
          />
          <button
            type="button"
            disabled={busy || code.trim().length < 3}
            onClick={() => void onRedeem(code.trim())}
            className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-orange-200/40 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[96px]"
          >
            {busy ? t.redeeming : t.redeem}
          </button>
        </div>
      )}

      {(promoActive || promoAiBonus > 0 || redeemedCode) && isLoggedIn ? (
        <div className="mt-3 space-y-1 rounded-xl border border-orange-100 bg-white/80 px-3 py-2.5 text-[12px] text-stone-700">
          {promoActive && promoProUntil ? (
            <p>
              {t.activeUntil}：<span className="font-bold text-orange-700">{promoProUntil.slice(0, 10)}</span>
            </p>
          ) : null}
          {promoAiBonus > 0 ? (
            <p>
              {t.aiBonus}：<span className="font-bold text-orange-700">+{promoAiBonus}</span>
            </p>
          ) : null}
          {redeemedCode ? (
            <p>
              {t.lastCode}：<span className="font-mono font-semibold text-stone-800">{redeemedCode}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
