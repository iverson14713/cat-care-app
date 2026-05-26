import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { authLog, isAuthNativeClient } from '../services/auth/authDebug';
import { NATIVE_OAUTH_URL_SCHEME } from '../services/auth/authRedirect';
import { notifyAuthRouteChange } from '../services/auth/authRoute';
import { isNativeOAuthCallbackUrl } from '../services/auth/nativeOAuthUrl';
import { closeOAuthBrowserIfOpen } from '../services/auth/oauthNative';

const CALLBACK_PATH = '/auth/callback';

function parseCallbackParams(rawUrl: string): Record<string, string | null> {
  try {
    const u = new URL(rawUrl);
    const search = u.searchParams;
    const hash = new URLSearchParams(u.hash.replace(/^#/, ''));
    return {
      code: search.get('code') || hash.get('code'),
      error: search.get('error') || hash.get('error') || hash.get('error_code'),
    };
  } catch {
    return { code: null, error: null };
  }
}

export function handleOAuthCallbackUrl(rawUrl: string, source: 'appUrlOpen' | 'getLaunchUrl'): void {
  const params = parseCallbackParams(rawUrl);
  authLog('navigateToAuthCallback.start', { source, rawUrl, ...params });

  void closeOAuthBrowserIfOpen();

  try {
    const incoming = new URL(rawUrl);
    const target = new URL(CALLBACK_PATH, window.location.origin);
    incoming.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value);
    });
    const hash = incoming.hash?.replace(/^#/, '');
    const path = `${target.pathname}${target.search}${hash ? `#${hash}` : ''}`;
    window.history.replaceState({}, document.title, path);
    window.dispatchEvent(new PopStateEvent('popstate'));
    notifyAuthRouteChange('navigateToAuthCallback');
  } catch {
    window.location.replace(CALLBACK_PATH);
    notifyAuthRouteChange('navigateToAuthCallback.fallback');
  }
}

function handleIncomingUrl(rawUrl: string, source: 'appUrlOpen' | 'getLaunchUrl'): void {
  if (isNativeOAuthCallbackUrl(rawUrl)) {
    handleOAuthCallbackUrl(rawUrl, source);
  }
}

export function initCapacitorAuthBridge(): void {
  if (!isAuthNativeClient()) return;

  authLog('bridge.init', {
    scheme: NATIVE_OAUTH_URL_SCHEME,
    expectedRedirect: `${NATIVE_OAUTH_URL_SCHEME}://auth/callback`,
  });

  void App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
    const url = event?.url ?? null;
    if (url) handleIncomingUrl(url, 'appUrlOpen');
  });

  void App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) return;
    void App.getLaunchUrl().then((launch) => {
      if (launch?.url) handleIncomingUrl(launch.url, 'getLaunchUrl');
    });
  });

  void App.getLaunchUrl().then((launch) => {
    if (launch?.url) handleIncomingUrl(launch.url, 'getLaunchUrl');
  });
}
