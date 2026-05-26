type AuthRouteListener = () => void;

const listeners = new Set<AuthRouteListener>();

export function subscribeAuthRouteChange(listener: AuthRouteListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyAuthRouteChange(reason: string): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch (e) {
      console.warn('[authRoute]', reason, e);
    }
  }
}

export function shouldRenderAuthCallback(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname.replace(/\/+$/, '') || '/';
  if (p === '/auth/callback') return true;
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return Boolean(
    params.get('code') ||
      params.get('error') ||
      hash.get('access_token') ||
      hash.get('code')
  );
}
