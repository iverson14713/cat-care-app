import { useEffect, useState } from 'react';
import { trackEvent } from './services/analytics';
import { getSupabaseClient } from './supabaseClient';
import { Spinner } from './components/SkeletonCard';

/** Handles Supabase PKCE return (`?code=`) for Google OAuth and hash/session for email flows. */

type Status = 'pending' | 'ok' | 'fail';

const copy = {
  zh: {
    pending: '正在完成登入…',
    okTitleEmail: '✅ Email 驗證成功',
    okTitleOauth: '✅ 登入成功',
    okSub: '正在返回 App…',
    fail: '連結已失效或無法登入，請稍後再試。',
    noClient: '無法連線驗證服務，請稍後再試。',
  },
  en: {
    pending: 'Finishing sign-in…',
    okTitleEmail: '✅ Email verified',
    okTitleOauth: '✅ Signed in',
    okSub: 'Returning to the app…',
    fail: 'This link is invalid or sign-in failed. Please try again.',
    noClient: 'Verification service is unavailable. Please try again later.',
  },
} as const;

function detectLang(): keyof typeof copy {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return nav.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function AuthCallbackPage() {
  const [status, setStatus] = useState<Status>('pending');
  const [oauthReturn, setOauthReturn] = useState(false);
  const lang = detectLang();
  const t = copy[lang];

  useEffect(() => {
    const sb = getSupabaseClient();
    if (!sb) {
      setStatus('fail');
      return;
    }

    const hash = window.location.hash.replace(/^#/, '');
    const hashParams = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(window.location.search);

    const err =
      hashParams.get('error') ||
      hashParams.get('error_code') ||
      searchParams.get('error');
    const errDesc = hashParams.get('error_description') || searchParams.get('error_description');
    if (err || (errDesc && /expired|invalid/i.test(errDesc))) {
      setStatus('fail');
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const code = searchParams.get('code');
        if (code) {
          const { error } = await sb.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setOauthReturn(true);
          trackEvent('login', { mode: 'google' });
        } else {
          const first = await sb.auth.getSession();
          if (first.error) throw first.error;
          if (!first.data.session) {
            await new Promise((r) => setTimeout(r, 450));
            if (cancelled) return;
            const second = await sb.auth.getSession();
            if (second.error) throw second.error;
            if (!second.data.session) throw new Error('no_session');
          }
        }
        if (cancelled) return;
        setStatus('ok');
        window.setTimeout(() => {
          window.location.replace('/');
        }, 2000);
      } catch {
        if (!cancelled) setStatus('fail');
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-orange-50 px-6 py-12 text-stone-800">
      <div className="w-full max-w-md animate-fade-in rounded-3xl border border-orange-100 bg-white/95 p-8 text-center shadow-[0_14px_44px_-16px_rgba(234,88,12,0.35)]">
        {status === 'pending' ? (
          <>
            <div className="mb-6 flex justify-center">
              <Spinner className="h-10 w-10 border-[3px]" />
            </div>
            <p className="text-[15px] font-semibold text-stone-800">{t.pending}</p>
            <div className="mt-6 space-y-2">
              <div className="animate-skeleton h-3 w-full rounded-lg bg-gradient-to-r from-stone-200/80 via-orange-100/70 to-stone-200/80 bg-[length:200%_100%]" />
              <div className="animate-skeleton h-3 w-4/5 rounded-lg bg-gradient-to-r from-stone-200/80 via-orange-100/70 to-stone-200/80 bg-[length:200%_100%]" />
            </div>
          </>
        ) : status === 'ok' ? (
          <>
            <h1 className="text-xl font-bold text-stone-900">
              {oauthReturn ? t.okTitleOauth : t.okTitleEmail}
            </h1>
            <p className="mt-3 text-[15px] text-stone-600">{t.okSub}</p>
          </>
        ) : (
          <>
            <p className="text-[15px] leading-relaxed text-stone-800">{getSupabaseClient() ? t.fail : t.noClient}</p>
            <button
              type="button"
              onClick={() => {
                window.location.replace('/');
              }}
              className="mt-6 w-full rounded-2xl bg-orange-500 py-3 text-[15px] font-bold text-white shadow-md shadow-orange-300/40 transition active:scale-[0.99]"
            >
              {lang === 'zh' ? '返回 App' : 'Back to app'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
