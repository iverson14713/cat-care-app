import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { authLog, isAuthNativeClient } from '../services/auth/authDebug';
import { CAPACITOR_AUTH_SCHEME_CALLBACK } from '../services/auth/authRedirect';
import {
  handleNativeOAuthCallbackUrl,
  isPetcareAuthCallbackUrl,
  recoverNativeOAuthFromWebViewUrl,
} from '../services/auth/nativeOAuthCallback';

let handlingCallback = false;

async function handleIncomingUrl(
  rawUrl: string,
  source: 'appUrlOpen' | 'getLaunchUrl'
): Promise<void> {
  if (!isPetcareAuthCallbackUrl(rawUrl)) return;

  if (handlingCallback) {
    authLog('bridge.duplicate_skip', { rawUrl, source });
    return;
  }

  handlingCallback = true;
  try {
    await handleNativeOAuthCallbackUrl(rawUrl, source);
  } finally {
    handlingCallback = false;
  }
}

export function initCapacitorAuthBridge(): void {
  if (!isAuthNativeClient()) return;

  authLog('bridge.init', {
    expectedRedirect: CAPACITOR_AUTH_SCHEME_CALLBACK,
  });

  void App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
    const url = event?.url ?? null;
    if (!url) return;
    authLog('bridge.appUrlOpen', { url });
    void handleIncomingUrl(url, 'appUrlOpen');
  });

  void App.getLaunchUrl().then((launch) => {
    if (launch?.url) void handleIncomingUrl(launch.url, 'getLaunchUrl');
  });

  recoverNativeOAuthFromWebViewUrl();
}
