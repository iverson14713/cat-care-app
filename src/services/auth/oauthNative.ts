import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { authLog, isAuthNativeClient } from './authDebug';

let browserOpen = false;

/**
 * Open Supabase OAuth URL outside the app WebView (SFSafariViewController / system browser).
 */
export async function openOAuthInExternalBrowser(url: string): Promise<void> {
  if (!isAuthNativeClient()) {
    throw new Error('openOAuthInExternalBrowser is only for native platforms');
  }

  authLog('oauth.openBrowser', {
    platform: Capacitor.getPlatform(),
    urlLength: url.length,
  });

  browserOpen = true;
  await Browser.open({
    url,
    presentationStyle: 'fullscreen',
    toolbarColor: '#ffffff',
  });
}

export async function closeOAuthBrowserIfOpen(): Promise<void> {
  if (!browserOpen) return;
  try {
    await Browser.close();
  } catch {
    // ignore
  }
  browserOpen = false;
}
