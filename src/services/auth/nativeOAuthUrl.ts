import { NATIVE_OAUTH_URL_SCHEME } from './authRedirect';

const CALLBACK_PATH = '/auth/callback';

export function isNativeOAuthCallbackUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    const lower = rawUrl.toLowerCase();
    if (lower.startsWith(`${NATIVE_OAUTH_URL_SCHEME}://`)) return true;
    if (u.pathname === CALLBACK_PATH || u.pathname.endsWith(CALLBACK_PATH)) return true;
    return lower.includes('auth/callback');
  } catch {
    return rawUrl.includes('auth/callback');
  }
}
