import type { SupabaseClient } from '@supabase/supabase-js';
import { authLog, isAuthNativeClient } from './authDebug';
import { getOAuthRedirectUrl, saveAuthReturnPath } from './authRedirect';
import { openOAuthInExternalBrowser } from './oauthNative';

const GOOGLE_QUERY = {
  access_type: 'offline',
  prompt: 'consent',
} as const;

/**
 * Google OAuth — web redirects in the browser; native opens Capacitor Browser (not WebView).
 */
export async function signInWithGoogleOAuth(
  supabase: SupabaseClient
): Promise<{ error: Error | null }> {
  saveAuthReturnPath();
  const isNative = isAuthNativeClient();
  const redirectTo = getOAuthRedirectUrl();

  authLog('google.click', { isNative, redirectTo });

  if (isNative) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: { ...GOOGLE_QUERY },
      },
    });

    if (error) return { error: new Error(error.message) };
    if (!data?.url) {
      return { error: new Error('無法取得 Google 登入網址，請稍後再試。') };
    }

    try {
      await openOAuthInExternalBrowser(data.url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'oauth_cancelled') return { error: new Error('oauth_cancelled') };
      return { error: new Error(`無法開啟登入瀏覽器：${msg}`) };
    }
    return { error: null };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: { ...GOOGLE_QUERY },
    },
  });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}
