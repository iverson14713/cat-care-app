import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js';
import { authLog } from './authDebug';

export type AuthCallbackFlow = 'email' | 'oauth' | 'unknown';

export type AuthCallbackOutcome =
  | { ok: true; flow: AuthCallbackFlow }
  | { ok: false; message: string };

let exchangeInflight: Promise<{ error: Error | null }> | null = null;

async function exchangePkceCodeOnce(
  client: SupabaseClient,
  code: string
): Promise<{ error: Error | null }> {
  if (!exchangeInflight) {
    exchangeInflight = client.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => ({ error: error ? new Error(error.message) : null }))
      .finally(() => {
        exchangeInflight = null;
      });
  }
  return exchangeInflight;
}

function parseHash(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.hash.replace(/^#/, ''));
}

function parseSearch(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function flowFromType(type: string | null): AuthCallbackFlow {
  if (!type) return 'unknown';
  const t = type.toLowerCase();
  if (t === 'signup' || t === 'email' || t === 'invite' || t === 'magiclink' || t === 'recovery') {
    return 'email';
  }
  return 'oauth';
}

export async function completeAuthCallback(client: SupabaseClient): Promise<AuthCallbackOutcome> {
  const hash = parseHash();
  const search = parseSearch();
  const codeInUrl = search.get('code') || hash.get('code');

  authLog('completeAuthCallback.start', {
    href: window.location.href,
    hasCode: Boolean(codeInUrl),
  });

  const existing = await client.auth.getSession();
  if (existing.error) {
    return { ok: false, message: existing.error.message };
  }
  if (existing.data.session?.access_token && !codeInUrl) {
    return { ok: true, flow: flowFromType(search.get('type') || hash.get('type')) };
  }

  const errCode = search.get('error') || hash.get('error') || search.get('error_code');
  const errDesc =
    search.get('error_description') || hash.get('error_description') || search.get('error_message');
  if (errCode || errDesc) {
    return { ok: false, message: errDesc || errCode || 'OAuth failed' };
  }

  const tokenHash = search.get('token_hash');
  const otpType = (search.get('type') || hash.get('type')) as EmailOtpType | null;
  if (tokenHash && otpType) {
    const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
    if (error) return { ok: false, message: error.message };
    return { ok: true, flow: flowFromType(otpType) };
  }

  const code = search.get('code');
  if (code) {
    console.log('[auth] completeAuthCallback exchanging code', {
      href: window.location.href,
      hasCode: true,
      codeLength: code.length,
    });
    const { error } = await exchangePkceCodeOnce(client, code);
    if (error) {
      console.error('[auth] completeAuthCallback exchangeCodeForSession failed', {
        href: window.location.href,
        message: error.message,
        hasCode: true,
      });
      return { ok: false, message: error.message };
    }
    const { data } = await client.auth.getSession();
    if (!data.session) {
      return { ok: false, message: 'Session not ready after sign-in' };
    }
    return { ok: true, flow: 'oauth' };
  }

  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true, flow: flowFromType(hash.get('type')) };
  }

  const retry = await client.auth.getSession();
  if (retry.data.session) {
    return { ok: true, flow: flowFromType(search.get('type') || hash.get('type')) };
  }

  return {
    ok: false,
    message: 'Could not finish sign-in. Please try again.',
  };
}
