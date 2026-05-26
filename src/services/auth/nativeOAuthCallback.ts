import type { SupabaseClient } from '@supabase/supabase-js';
import { authLog, isAuthNativeClient } from './authDebug';
import {
  CAPACITOR_AUTH_SCHEME_CALLBACK,
  redirectAfterAuthSuccess,
  scrubAuthCallbackUrl,
} from './authRedirect';
import { emitNativeAuthError, emitNativeAuthSuccess } from './authNativeEvents';
import { isOAuthCodeUsed, markOAuthCodeUsed } from './oauthCodeStore';
import { closeOAuthBrowserIfOpen } from './oauthNative';
import { getSupabaseClient } from '../../supabaseClient';

let exchangeInflight: Promise<{ ok: boolean; code: string }> | null = null;

function detectLang(): 'zh' | 'en' {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return nav.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function failMessage(lang: 'zh' | 'en'): string {
  return lang === 'zh'
    ? '登入失敗，請稍後再試或改用 Email 登入。'
    : 'Sign-in failed. Please try again or use email sign-in.';
}

export function isPetcareAuthCallbackUrl(rawUrl: string): boolean {
  const lower = rawUrl.trim().toLowerCase();
  return (
    lower.startsWith(`${CAPACITOR_AUTH_SCHEME_CALLBACK}`) ||
    lower.startsWith('petcare://auth/callback')
  );
}

async function exchangeCodeOnce(client: SupabaseClient, code: string): Promise<boolean> {
  if (!exchangeInflight) {
    exchangeInflight = client.auth
      .exchangeCodeForSession(code)
      .then(({ data, error }) => {
        if (error) {
          console.error('[auth] exchangeCodeForSession failed', {
            message: error.message,
            status: error.status,
            code: error.code,
            name: error.name,
            authCode: code,
            codeAlreadyUsed: isOAuthCodeUsed(code),
          });
          return { ok: false, code };
        }
        if (!data.session) {
          console.error('[auth] exchangeCodeForSession returned no session', {
            hasUser: Boolean(data.user),
            authCode: code,
          });
          return { ok: false, code };
        }
        markOAuthCodeUsed(code);
        return { ok: true, code };
      })
      .finally(() => {
        exchangeInflight = null;
      });
  }
  const result = await exchangeInflight;
  return result.ok;
}

/**
 * iOS Capacitor: handle petcare://auth/callback in-app (no /auth/callback WebView page).
 */
export async function handleNativeOAuthCallbackUrl(
  rawUrl: string,
  source: 'appUrlOpen' | 'getLaunchUrl' | 'webview-recover' = 'appUrlOpen'
): Promise<boolean> {
  if (!isAuthNativeClient()) return false;

  authLog('nativeOAuthCallback.start', { source, rawUrl });

  if (!isPetcareAuthCallbackUrl(rawUrl)) {
    authLog('nativeOAuthCallback.skip', { rawUrl, reason: 'not_petcare_callback' });
    return false;
  }

  const lang = detectLang();

  await closeOAuthBrowserIfOpen();

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (e) {
    console.error('[auth] OAuth callback invalid url', {
      url: rawUrl,
      source,
      error: e instanceof Error ? e.message : String(e),
    });
    emitNativeAuthError({ message: failMessage(lang), url: rawUrl });
    return false;
  }

  const code = parsed.searchParams.get('code');
  const error = parsed.searchParams.get('error') || parsed.searchParams.get('error_code');
  const errorDescription =
    parsed.searchParams.get('error_description') || parsed.searchParams.get('error_message');

  if (error || errorDescription) {
    console.error('[auth] OAuth callback error', {
      url: rawUrl,
      source,
      error,
      errorDescription,
      hasCode: Boolean(code),
    });
    emitNativeAuthError({
      message: failMessage(lang),
      url: rawUrl,
      code,
      error,
      errorDescription,
    });
    return false;
  }

  if (!code) {
    console.error('[auth] OAuth callback missing code', {
      url: rawUrl,
      source,
      search: parsed.search,
      hash: parsed.hash,
      hasCode: false,
    });
    emitNativeAuthError({
      message: failMessage(lang),
      url: rawUrl,
      code: null,
    });
    return false;
  }

  const sb = getSupabaseClient();
  if (!sb) {
    console.error('[auth] Supabase client not configured', { url: rawUrl, hasCode: true });
    emitNativeAuthError({ message: failMessage(lang), url: rawUrl, code });
    return false;
  }

  const { data: existingSession } = await sb.auth.getSession();
  if (existingSession.session?.access_token) {
    console.log('[auth] OAuth callback skipped — session already active', {
      url: rawUrl,
      source,
      userId: existingSession.session.user?.id,
    });
    scrubAuthCallbackUrl();
    emitNativeAuthSuccess(existingSession.session.user?.id);
    await redirectAfterAuthSuccess(sb, 0);
    return true;
  }

  if (isOAuthCodeUsed(code)) {
    console.log('[auth] OAuth callback skipped — auth code already exchanged', {
      url: rawUrl,
      source,
      codeLength: code.length,
    });
    const { data: retrySession } = await sb.auth.getSession();
    if (retrySession.session) {
      scrubAuthCallbackUrl();
      await redirectAfterAuthSuccess(sb, 0);
      return true;
    }
    if (source === 'getLaunchUrl') {
      return false;
    }
  }

  console.log('[auth] OAuth callback exchanging code', {
    url: rawUrl,
    source,
    hasCode: true,
    codeLength: code.length,
  });

  const ok = await exchangeCodeOnce(sb, code);
  if (!ok) {
    const { data: recovered } = await sb.auth.getSession();
    if (recovered.session?.access_token) {
      console.log('[auth] OAuth exchange failed but session recovered', {
        url: rawUrl,
        source,
        userId: recovered.session.user?.id,
      });
      scrubAuthCallbackUrl();
      await redirectAfterAuthSuccess(sb, 0);
      return true;
    }
    emitNativeAuthError({
      message: failMessage(lang),
      url: rawUrl,
      code,
      exchangeMessage: 'exchangeCodeForSession failed',
    });
    return false;
  }

  const { data: sessionData } = await sb.auth.getSession();
  const userId = sessionData.session?.user?.id;
  console.log('[auth] OAuth login success', {
    userId,
    url: rawUrl,
    source,
  });

  scrubAuthCallbackUrl();
  emitNativeAuthSuccess(userId);
  await redirectAfterAuthSuccess(sb, 200);
  return true;
}

/** If WebView was navigated to /auth/callback?code=, recover without showing callback UI. */
export function recoverNativeOAuthFromWebViewUrl(): void {
  if (!isAuthNativeClient() || typeof window === 'undefined') return;

  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/auth/callback') return;

  const search = window.location.search;
  const hash = window.location.hash;
  if (!search && !hash) return;

  let schemeUrl = 'petcare://auth/callback';
  if (window.location.search) {
    schemeUrl += window.location.search;
  } else if (window.location.hash) {
    schemeUrl += `?${window.location.hash.replace(/^#/, '')}`;
  }

  authLog('recoverNativeOAuthFromWebViewUrl', {
    href: window.location.href,
    schemeUrl,
  });
  void handleNativeOAuthCallbackUrl(schemeUrl, 'webview-recover');
}
