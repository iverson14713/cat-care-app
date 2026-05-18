import { useEffect, useState } from 'react';
import App from './App.tsx';
import { AuthCallbackPage } from './AuthCallbackPage.tsx';

function normalizePath(pathname: string): string {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/auth/callback' || p.startsWith('/auth/callback/')) return '/auth/callback';
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

  return <App />;
}
