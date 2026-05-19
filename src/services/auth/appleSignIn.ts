import type { SupabaseClient } from '@supabase/supabase-js';

export type AppleSignInResult = {
  ok: boolean;
  /** True when native / OAuth flow completed (future). */
  signedIn: boolean;
  message?: string;
};

/**
 * Whether Apple Sign In can run on this platform (native / configured OAuth).
 * Web/PWA returns false until Supabase Apple provider + iOS shell are wired.
 */
export function isAppleSignInAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  // Future: Capacitor.getPlatform() === 'ios' && has native plugin
  return false;
}

/**
 * Apple Sign In entry — reserved for Supabase `signInWithOAuth({ provider: 'apple' })`
 * or Capacitor Sign in with Apple on iOS.
 */
export async function handleAppleSignIn(
  _supabase?: SupabaseClient | null
): Promise<AppleSignInResult> {
  if (isAppleSignInAvailable() && _supabase) {
    // Future implementation:
    // const { error } = await _supabase.auth.signInWithOAuth({ provider: 'apple', ... });
    return { ok: false, signedIn: false, message: 'not_implemented' };
  }

  return {
    ok: true,
    signedIn: false,
    message: 'coming_soon',
  };
}
