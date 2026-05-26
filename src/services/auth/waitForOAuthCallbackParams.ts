import { authLog } from './authDebug';
import { hasOAuthCallbackParams } from './authRoute';

/** Wait for deep link to write ?code= into the WebView URL before failing. */
export async function waitForOAuthCallbackParams(options?: {
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<boolean> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  const intervalMs = options?.intervalMs ?? 40;
  const deadline = Date.now() + timeoutMs;

  if (hasOAuthCallbackParams()) return true;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    if (hasOAuthCallbackParams()) {
      authLog('waitForOAuthCallbackParams.ok', {});
      return true;
    }
  }

  authLog('waitForOAuthCallbackParams.timeout', { href: window.location.href });
  return hasOAuthCallbackParams();
}
