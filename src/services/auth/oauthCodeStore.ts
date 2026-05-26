const USED_CODE_KEY = 'petcare_oauth_used_code';

export function getUsedOAuthCode(): string | null {
  try {
    return sessionStorage.getItem(USED_CODE_KEY);
  } catch {
    return null;
  }
}

export function markOAuthCodeUsed(code: string): void {
  try {
    sessionStorage.setItem(USED_CODE_KEY, code);
  } catch {
    // ignore
  }
}

export function isOAuthCodeUsed(code: string): boolean {
  return getUsedOAuthCode() === code;
}

export function clearUsedOAuthCode(): void {
  try {
    sessionStorage.removeItem(USED_CODE_KEY);
  } catch {
    // ignore
  }
}
