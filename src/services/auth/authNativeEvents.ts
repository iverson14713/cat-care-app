export const NATIVE_AUTH_ERROR_EVENT = 'petcare-native-auth-error';
export const NATIVE_AUTH_SUCCESS_EVENT = 'petcare-native-auth-success';

export type NativeAuthErrorDetail = {
  message: string;
  url?: string;
  code?: string | null;
  error?: string | null;
  errorDescription?: string | null;
  exchangeMessage?: string;
};

export function emitNativeAuthError(detail: NativeAuthErrorDetail): void {
  console.error('[auth] OAuth callback failed', detail);
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NATIVE_AUTH_ERROR_EVENT, { detail }));
}

export function emitNativeAuthSuccess(userId?: string): void {
  console.log('[auth] OAuth login success', userId ?? '(no user id)');
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NATIVE_AUTH_SUCCESS_EVENT, { detail: { userId } }));
}
