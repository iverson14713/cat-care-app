import { useEffect, useState } from 'react';
import { AppLaunchGate } from './AppLaunchGate.tsx';
import { AuthCallbackPage } from './AuthCallbackPage.tsx';
import { AppStoreScreenshotMode } from './pages/AppStoreScreenshotMode.tsx';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage.tsx';
import { TermsPage } from './pages/TermsPage.tsx';

function normalizePath(pathname: string): string {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/auth/callback' || p.startsWith('/auth/callback/')) return '/auth/callback';
  if (p === '/privacy') return '/privacy';
  if (p === '/terms') return '/terms';
  if (p === '/app-store-screenshots') return '/app-store-screenshots';
  return p;
}

export function Root() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const sync = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  if (path === '/auth/callback') {
    return <AuthCallbackPage />;
  }

  if (path === '/privacy') {
    return <PrivacyPolicyPage />;
  }

  if (path === '/terms') {
    return <TermsPage />;
  }

  if (path === '/app-store-screenshots') {
    return <AppStoreScreenshotMode />;
  }

  return <AppLaunchGate />;
}
