import { APP_STORE_FONT_FAMILY, NOTO_SANS_TC_URL } from './constants';

const FONT_LINK_ID = 'app-store-noto-sans-tc';

let fontsReadyPromise: Promise<void> | null = null;

function injectNotoSansTc(): void {
  if (document.getElementById(FONT_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = NOTO_SANS_TC_URL;
  document.head.appendChild(link);
}

/** Wait for web + system fonts before html2canvas export. */
export function ensureAppStoreFontsReady(): Promise<void> {
  if (!fontsReadyPromise) {
    fontsReadyPromise = (async () => {
      injectNotoSansTc();
      try {
        await document.fonts.load('400 16px "Noto Sans TC"');
        await document.fonts.load('500 16px "Noto Sans TC"');
        await document.fonts.load('700 16px "Noto Sans TC"');
      } catch {
        // ignore — fall back to system fonts
      }
      await document.fonts.ready;
    })();
  }
  return fontsReadyPromise;
}
