import { useEffect, useState } from 'react';
import App from './App.tsx';
import { SplashScreen } from './components/SplashScreen.tsx';
import {
  delay,
  runSplashBootstrap,
  SPLASH_MIN_MS,
  type AppBootstrapResult,
} from './appBootstrap.ts';
import { AppBootstrapProvider } from './AppBootstrapContext.tsx';
import { ensureAppStoreFontsReady } from './components/appStore/fonts.ts';
import { trackEvent } from './services/analytics.ts';

type Phase = 'splash' | 'app';

function splashSubtitle(): string {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'zh';
  return nav.toLowerCase().startsWith('zh') ? '正在準備你的照護資料...' : 'Preparing your care data...';
}

export function AppLaunchGate() {
  const [phase, setPhase] = useState<Phase>('splash');
  const [bootstrap, setBootstrap] = useState<AppBootstrapResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    const prevOverflow = document.body.style.overflow;

    const run = async () => {
      document.body.style.overflow = 'hidden';
      const started = Date.now();

      let result: AppBootstrapResult;
      try {
        const [boot] = await Promise.all([runSplashBootstrap(), ensureAppStoreFontsReady()]);
        result = boot;
      } catch (err) {
        console.error('[bootstrap] launch gate', err);
        result = await runSplashBootstrap();
      }

      const elapsed = Date.now() - started;
      if (elapsed < SPLASH_MIN_MS) {
        await delay(SPLASH_MIN_MS - elapsed);
      }

      if (cancelled) return;

      setBootstrap(result);
      setPhase('app');
      trackEvent('app_open');
      document.body.style.overflow = prevOverflow;
    };

    void run();

    return () => {
      cancelled = true;
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  if (phase === 'splash' || !bootstrap) {
    return <SplashScreen active statusText={splashSubtitle()} />;
  }

  return (
    <AppBootstrapProvider value={bootstrap}>
      <App />
    </AppBootstrapProvider>
  );
}
