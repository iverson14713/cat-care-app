import { useEffect, useState } from 'react';
import App from './App.tsx';
import { SplashScreen } from './components/SplashScreen.tsx';
import { delay, runAppBootstrap, SPLASH_MIN_MS, type AppBootstrapResult } from './appBootstrap.ts';
import { AppBootstrapProvider } from './AppBootstrapContext.tsx';
import { ensureAppStoreFontsReady } from './components/appStore/fonts.ts';

type Phase = 'splash' | 'app';

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
        const [boot] = await Promise.all([runAppBootstrap(), ensureAppStoreFontsReady()]);
        result = boot;
      } catch (err) {
        console.error('[bootstrap]', err);
        result = await runAppBootstrap();
      }

      const elapsed = Date.now() - started;
      if (elapsed < SPLASH_MIN_MS) {
        await delay(SPLASH_MIN_MS - elapsed);
      }

      if (cancelled) return;

      setBootstrap(result);
      setPhase('app');
      document.body.style.overflow = prevOverflow;
    };

    void run();

    return () => {
      cancelled = true;
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  if (phase === 'splash' || !bootstrap) {
    return <SplashScreen active />;
  }

  return (
    <AppBootstrapProvider value={bootstrap}>
      <App />
    </AppBootstrapProvider>
  );
}
