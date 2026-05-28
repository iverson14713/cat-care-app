import { Capacitor } from '@capacitor/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import PetCareAppleSignIn from '../../native/petCareAppleSignIn';
import { authLog, isAuthNativeClient } from './authDebug';
import { getOAuthRedirectUrl, redirectAfterAuthSuccess, saveAuthReturnPath } from './authRedirect';
import { openOAuthInExternalBrowser } from './oauthNative';

export type AppleSignInResult =
  | { ok: true; signedIn: boolean; message: 'redirecting' | 'coming_soon' | 'cancelled' }
  | { ok: false; signedIn: false; message: string; code?: 'coming_soon' | 'web' | 'failed' };

export const APPLE_SIGN_IN_FAILED_ZH = 'Apple 登入失敗，請稍後再試或改用 Email 登入';
export const APPLE_SIGN_IN_FAILED_EN =
  'Apple sign-in failed. Please try again later or use email sign-in.';

export function getAppleSignInUserErrorMessage(lang: 'zh' | 'en' = 'zh'): string {
  return lang === 'zh' ? APPLE_SIGN_IN_FAILED_ZH : APPLE_SIGN_IN_FAILED_EN;
}

export function isAppleOAuthEnabled(): boolean {
  if (import.meta.env.VITE_APPLE_OAUTH_ENABLED === 'true') return true;
  return import.meta.env.MODE === 'capacitor' && isAuthNativeClient();
}

export function isAppleSignInNativeUi(): boolean {
  return isAuthNativeClient();
}

export function isAppleSignInWebComingSoon(): boolean {
  return !isAuthNativeClient();
}

export function isAppleSignInAvailable(supabase?: SupabaseClient | null): boolean {
  return isAppleSignInNativeUi() && isAppleOAuthEnabled() && Boolean(supabase);
}

export function shouldShowAppleSignInButton(): boolean {
  return isAppleSignInNativeUi();
}

function isIosNative(): boolean {
  return isAuthNativeClient() && Capacitor.getPlatform() === 'ios';
}

function isAppleAudienceMismatchError(error: { message?: string } | null): boolean {
  const msg = error?.message?.toLowerCase() ?? '';
  return msg.includes('unacceptable audience') || msg.includes('audience in id_token');
}

/** Capacitor shows this when the native class is not in `packageClassList` / not loaded. */
function isNativeApplePluginUnavailableError(e: unknown): boolean {
  const err = e as Error & { code?: string };
  const code = String(err?.code ?? '').toUpperCase();
  if (code === 'UNIMPLEMENTED') return true;
  const msg = (err?.message ?? String(e ?? '')).toLowerCase();
  return msg.includes('not implemented') && msg.includes('plugin');
}

let appleSignInHandleInFlight = false;

export async function signInWithAppleNative(
  supabase: SupabaseClient,
  lang: 'zh' | 'en' = 'zh'
): Promise<{ error: Error | null; signedIn?: boolean }> {
  const userError = getAppleSignInUserErrorMessage(lang);
  saveAuthReturnPath('/');

  if (!isAppleOAuthEnabled()) {
    return { error: new Error('apple_not_enabled') };
  }

  try {
    const { identityToken } = await PetCareAppleSignIn.signIn();
    authLog('apple.native.token', { tokenLength: identityToken.length });

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken,
    });

    if (error) {
      authLog('apple.native.idTokenError', { message: error.message, code: error.code });
      if (isAppleAudienceMismatchError(error)) {
        return { error: new Error('apple_audience_mismatch') };
      }
      return { error: new Error(userError) };
    }
    if (!data?.session) {
      authLog('apple.native.noSession', { hasUser: Boolean(data?.user) });
      return { error: new Error(userError) };
    }

    authLog('apple.native.sessionOk', { userId: data.session.user?.id });
    await redirectAfterAuthSuccess(supabase);
    return { error: null, signedIn: true };
  } catch (e) {
    const pluginErr = e as Error & { code?: string };
    if (pluginErr?.code === 'CANCELED') {
      return { error: new Error('oauth_cancelled') };
    }
    if (isNativeApplePluginUnavailableError(e)) {
      authLog('apple.native.pluginUnavailable', { message: pluginErr?.message });
      return { error: new Error('native_plugin_unavailable') };
    }
    authLog('apple.native.signInError', { message: pluginErr?.message ?? String(e), code: pluginErr?.code });
    return { error: new Error(userError) };
  }
}

export async function signInWithAppleOAuth(
  supabase: SupabaseClient,
  lang: 'zh' | 'en' = 'zh'
): Promise<{ error: Error | null }> {
  const userError = getAppleSignInUserErrorMessage(lang);
  if (!isAuthNativeClient()) return { error: new Error('web_not_supported') };
  if (!isAppleOAuthEnabled()) return { error: new Error('apple_not_enabled') };

  saveAuthReturnPath('/');
  const redirectTo = getOAuthRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      scopes: 'name email',
    },
  });

  if (error || !data?.url) {
    return { error: new Error(userError) };
  }

  try {
    await openOAuthInExternalBrowser(data.url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'oauth_cancelled') return { error: new Error('oauth_cancelled') };
    return { error: new Error(userError) };
  }

  return { error: null };
}

async function runAppleOAuthFallbackOnce(
  supabase: SupabaseClient,
  lang: 'zh' | 'en',
  reason: string
): Promise<{ error: Error | null }> {
  authLog('apple.fallback.oauth', { reason });
  return signInWithAppleOAuth(supabase, lang);
}

export async function signInWithApple(
  supabase: SupabaseClient,
  lang: 'zh' | 'en' = 'zh'
): Promise<{ error: Error | null; signedIn?: boolean }> {
  if (isIosNative()) {
    const native = await signInWithAppleNative(supabase, lang);
    if (!native.error) return native;
    if (native.error.message === 'oauth_cancelled') return native;

    if (native.error.message === 'apple_audience_mismatch') {
      const oauth = await runAppleOAuthFallbackOnce(supabase, lang, 'audience_mismatch');
      return { error: oauth.error };
    }
    if (native.error.message === 'native_plugin_unavailable') {
      const oauth = await runAppleOAuthFallbackOnce(supabase, lang, 'native_plugin_unavailable');
      return { error: oauth.error };
    }
    return native;
  }
  const { error } = await signInWithAppleOAuth(supabase, lang);
  return { error };
}

export async function handleAppleSignIn(
  supabase?: SupabaseClient | null,
  lang: 'zh' | 'en' = 'zh'
): Promise<AppleSignInResult> {
  const userError = getAppleSignInUserErrorMessage(lang);

  if (appleSignInHandleInFlight) {
    return { ok: true, signedIn: false, message: 'cancelled' };
  }
  appleSignInHandleInFlight = true;

  try {
    if (!supabase) {
      return { ok: false, signedIn: false, message: userError, code: 'failed' };
    }

    if (isAppleSignInWebComingSoon()) {
      return { ok: true, signedIn: false, message: 'coming_soon' };
    }

    const { error, signedIn } = await signInWithApple(supabase, lang);
    if (error) {
      if (error.message === 'web_not_supported' || error.message === 'apple_not_enabled') {
        return { ok: true, signedIn: false, message: 'coming_soon' };
      }
      if (error.message === 'oauth_cancelled') {
        return { ok: true, signedIn: false, message: 'cancelled' };
      }
      return { ok: false, signedIn: false, message: userError, code: 'failed' };
    }

    if (signedIn) {
      return { ok: true, signedIn: true, message: 'redirecting' };
    }

    return { ok: true, signedIn: false, message: 'redirecting' };
  } finally {
    appleSignInHandleInFlight = false;
  }
}
