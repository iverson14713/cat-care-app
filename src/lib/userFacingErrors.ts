import type { Lang } from './lang';

/** Map auth / network errors to production-safe copy (no vendor or infra names). */
export function formatAuthErrorForUser(lang: Lang, err: unknown): string {
  const zh = lang === 'zh';
  if (err instanceof Error && err.message === 'not_configured') {
    return zh
      ? '帳號服務暫時無法使用，請稍後再試。'
      : 'Account service is temporarily unavailable. Please try again later.';
  }

  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message?: string }).message ?? '')
      : String(err ?? '');
  const low = msg.toLowerCase();

  if (low.includes('invalid login credentials')) {
    return zh ? '帳號或密碼不正確。' : 'Invalid email or password.';
  }
  if (low.includes('email not confirmed')) {
    return zh ? '請先到信箱完成驗證，再登入。' : 'Please confirm your email, then sign in.';
  }
  if (low.includes('already registered') || low.includes('user already registered')) {
    return zh ? '此信箱已註冊，請改為登入。' : 'This email is already registered — try signing in.';
  }
  if (low.includes('password')) {
    return zh
      ? '密碼不符合要求，請改用更長或更複雜的密碼。'
      : 'Password does not meet requirements — try a longer password.';
  }
  if (
    low.includes('network') ||
    low.includes('fetch') ||
    low.includes('offline') ||
    low.includes('timeout') ||
    low.includes('failed to fetch')
  ) {
    return zh ? '網路連線不穩，請確認連線後再試。' : 'Network connection is unstable. Check your connection and try again.';
  }
  if (low.includes('oauth_cancelled') || low.includes('cancel')) {
    return zh ? '已取消登入。' : 'Sign-in was canceled.';
  }

  return zh ? '登入失敗，請稍後再試。' : 'Sign-in failed. Please try again later.';
}

export function authServiceUnavailableMessage(lang: Lang): string {
  return lang === 'zh'
    ? '帳號服務暫時無法使用，請稍後再試。'
    : 'Account service is temporarily unavailable. Please try again later.';
}

export function appleSignInUnavailableMessage(lang: Lang): string {
  return lang === 'zh'
    ? '目前無法完成 Apple 登入，請改用 Email 登入或稍後再試。'
    : 'Apple sign-in is unavailable. Use email sign-in or try again later.';
}
