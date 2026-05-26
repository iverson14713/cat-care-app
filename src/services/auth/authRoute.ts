import { isAuthNativeClient } from './authDebug';

type AuthRouteListener = () => void;

export const AUTH_ROUTE_EVENT = 'petcare-auth-route';

const listeners = new Set<AuthRouteListener>();

export function subscribeAuthRouteChange(listener: AuthRouteListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyAuthRouteChange(reason: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_ROUTE_EVENT, { detail: { reason } }));
  }
  for (const fn of listeners) {
    try {
      fn();
    } catch (e) {
      console.warn('[authRoute]', reason, e);
    }
  }
}

export function hasOAuthCallbackParams(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return Boolean(
    params.get('code') ||
      params.get('error') ||
      params.get('error_code') ||
      hash.get('code') ||
      hash.get('access_token') ||
      hash.get('error')
  );
}

export function shouldRenderAuthCallback(): boolean {
  if (typeof window === 'undefined') return false;
  if (isAuthNativeClient()) return false;
  const p = window.location.pathname.replace(/\/+$/, '') || '/';
  if (p === '/auth/callback') return true;
  return hasOAuthCallbackParams();
}
