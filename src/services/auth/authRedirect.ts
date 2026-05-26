import type { SupabaseClient } from '@supabase/supabase-js';
import { authLog, isAuthNativeClient } from './authDebug';

const RETURN_KEY = 'petcare_auth_return';

/** Must match capacitor.config.ts `server.hostname` */
export const CAPACITOR_AUTH_ORIGIN = 'https://petcare.app';

/** Web / email verification redirect (Supabase Redirect URLs whitelist). */
export const WEB_AUTH_CALLBACK_URL = 'https://cat-care-app2.vercel.app/auth/callback';

/** iOS OAuth custom URL scheme (Info.plist CFBundleURLSchemes) */
export const NATIVE_OAUTH_URL_SCHEME = 'petcare';

export const CAPACITOR_AUTH_SCHEME_CALLBACK = `${NATIVE_OAUTH_URL_SCHEME}://auth/callback`;

export function getAuthCallbackUrl(): string {
  if (typeof window === 'undefined') return '/auth/callback';
  if (isAuthNativeClient()) {
    return `${CAPACITOR_AUTH_ORIGIN}/auth/callback`;
  }
  return WEB_AUTH_CALLBACK_URL;
}

export function getOAuthRedirectUrl(): string {
  if (typeof window === 'undefined') return WEB_AUTH_CALLBACK_URL;
  const url = isAuthNativeClient() ? CAPACITOR_AUTH_SCHEME_CALLBACK : WEB_AUTH_CALLBACK_URL;
  authLog('getOAuthRedirectUrl', { url, isNative: isAuthNativeClient() });
  return url;
}

export function saveAuthReturnPath(path?: string): void {
  if (typeof window === 'undefined') return;
  const next = path ?? `${window.location.pathname}${window.location.search}`;
  const safe = next.startsWith('/auth') ? '/' : next || '/';
  try {
    sessionStorage.setItem(RETURN_KEY, safe);
  } catch {
    // ignore
  }
}

export function consumeAuthReturnPath(): string {
  if (typeof window === 'undefined') return '/';
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    if (!raw || raw.startsWith('/auth')) return '/';
    return raw;
  } catch {
    return '/';
  }
}

export function navigateAfterAuthSuccess(target: string): void {
  const path = target.startsWith('/') ? target : `/${target}`;
  window.history.replaceState({}, document.title, path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  authLog('navigateAfterAuthSuccess', { path });
}

export async function waitForPersistedSession(
  client: SupabaseClient,
  attempts = 12,
  delayMs = 150
): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    const { data } = await client.auth.getSession();
    if (data.session) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

export async function redirectAfterAuthSuccess(client: SupabaseClient, delayMs = 400): Promise<void> {
  const ok = await waitForPersistedSession(client);
  if (!ok) authLog('redirectAfterAuthSuccess.no_session', {});
  try {
    sessionStorage.setItem('petcare_skip_splash_once', '1');
  } catch {
    // ignore
  }
  const target = consumeAuthReturnPath();
  if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  navigateAfterAuthSuccess(target);
}

export function scrubAuthCallbackUrl(): void {
  if (typeof window === 'undefined') return;
  const path = isAuthNativeClient() ? '/' : window.location.pathname || '/auth/callback';
  window.history.replaceState({}, document.title, path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
