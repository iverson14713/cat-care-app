const CLIENT_KEY = 'cat-ai-client-id';
const PLAN_KEY = 'cat-ai-plan';
const CARE_PREFIX = 'cat-ai-care:v2:';

export function getOrCreateClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id || id.trim().length < 8) {
      id = crypto.randomUUID();
      localStorage.setItem(CLIENT_KEY, id);
    }
    return id.trim();
  } catch {
    return `fallback-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

/** Client hint only; server grants Pro via AI_PRO_CLIENT_IDS. */
export function getAiPlan(): 'free' | 'pro' {
  try {
    return localStorage.getItem(PLAN_KEY) === 'pro' ? 'pro' : 'free';
  } catch {
    return 'free';
  }
}

export function djb2Hash(str: string): string {
  let h = 5381 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

export function careBundleCacheKey(catId: string, usageDate: string, contextHash: string): string {
  return `${CARE_PREFIX}${catId}:${usageDate}:${contextHash}`;
}

export function readCareBundleCacheJson(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeCareBundleCacheJson(key: string, json: string): void {
  try {
    sessionStorage.setItem(key, json);
  } catch {
    // quota / private mode
  }
}
