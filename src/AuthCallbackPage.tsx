import { useEffect, useState } from 'react';
import { Spinner } from './components/SkeletonCard';
import { trackEvent } from './services/analytics';
import { completeAuthCallback, type AuthCallbackFlow } from './services/auth/completeAuthCallback';
import { redirectAfterAuthSuccess, scrubAuthCallbackUrl } from './services/auth/authRedirect';
import { AUTH_ROUTE_EVENT } from './services/auth/authRoute';
import { waitForOAuthCallbackParams } from './services/auth/waitForOAuthCallbackParams';
import { getSupabaseClient } from './supabaseClient';

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

function callbackUrlKey(): string {
  return `${window.location.href}`;
}

function logCallbackContext(phase: string): void {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const code = params.get('code') || hash.get('code');
  console.log(`[auth] AuthCallbackPage.${phase}`, {
    href: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    hasCode: Boolean(code),
    codeLength: code?.length ?? 0,
    error: params.get('error') || hash.get('error'),
    error_description: params.get('error_description') || hash.get('error_description'),
  });
}

/** Web-only Supabase OAuth / email verification callback. */
export function AuthCallbackPage() {
  const [status, setStatus] = useState<Status>('pending');
  const [flow, setFlow] = useState<AuthCallbackFlow>('unknown');
  const [urlKey, setUrlKey] = useState(() => callbackUrlKey());
  const lang = detectLang();
  const t = copy[lang];

  useEffect(() => {
    const sync = () => setUrlKey(callbackUrlKey());
    window.addEventListener(AUTH_ROUTE_EVENT, sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener(AUTH_ROUTE_EVENT, sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  useEffect(() => {
    logCallbackContext('mount');

    const sb = getSupabaseClient();
    if (!sb) {
      console.error('[auth] AuthCallbackPage no Supabase client');
      setStatus('fail');
      return;
    }

    let cancelled = false;
    setStatus('pending');

    const run = async () => {
      try {
        const ready = await waitForOAuthCallbackParams();
        if (cancelled) return;
        if (!ready) {
          logCallbackContext('fail_no_params');
          setStatus('fail');
          return;
        }

        const outcome = await completeAuthCallback(sb);
        if (cancelled) return;

        scrubAuthCallbackUrl();

        if (!outcome.ok) {
          console.error('[auth] AuthCallbackPage completeAuthCallback failed', {
            href: window.location.href,
            message: outcome.message,
          });
          setStatus('fail');
          return;
        }

        setFlow(outcome.flow);
        if (outcome.flow === 'oauth') {
          trackEvent('login', { mode: 'google' });
        }

        setStatus('ok');
        window.setTimeout(() => {
          void redirectAfterAuthSuccess(sb, 0);
        }, 1200);
      } catch (e) {
        console.error('[auth] AuthCallbackPage unexpected error', {
          href: window.location.href,
          message: e instanceof Error ? e.message : String(e),
        });
        if (!cancelled) setStatus('fail');
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [urlKey]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-orange-50 px-6 py-12 text-stone-800">
      <div className="w-full max-w-md animate-fade-in rounded-3xl border border-orange-100 bg-white/95 p-8 text-center shadow-[0_14px_44px_-16px_rgba(234,88,12,0.35)]">
        {status === 'pending' ? (
          <>
            <div className="mb-6 flex justify-center">
              <Spinner className="h-10 w-10 border-[3px]" />
            </div>
            <p className="text-[15px] font-semibold text-stone-800">{t.pending}</p>
          </>
        ) : status === 'ok' ? (
          <>
            <h1 className="text-xl font-bold text-stone-900">
              {flow === 'oauth' ? t.okTitleOauth : t.okTitleEmail}
            </h1>
            <p className="mt-3 text-[15px] text-stone-600">{t.okSub}</p>
          </>
        ) : (
          <>
            <p className="text-[15px] leading-relaxed text-stone-800">
              {getSupabaseClient() ? t.fail : t.noClient}
            </p>
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
