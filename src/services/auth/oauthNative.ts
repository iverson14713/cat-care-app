import { Browser } from '@capacitor/browser';
import { authLog } from './authDebug';

let browserOpen = false;

export async function openOAuthInExternalBrowser(url: string): Promise<void> {
  authLog('oauth.openBrowser', { url });
  browserOpen = true;
  await Browser.open({ url, presentationStyle: 'popover' });
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
