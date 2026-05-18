/** Safe localStorage / sessionStorage helpers — never throw on corrupt data. */

export function storageError(context: string, err: unknown, key?: string): void {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(`[storage] ${context}${key ? ` (key: ${key})` : ''}:`, detail, err);
}

export function safeGetItem(key: string, storage: Storage = localStorage): string | null {
  try {
    return storage.getItem(key);
  } catch (err) {
    storageError('getItem failed', err, key);
    return null;
  }
}

export function safeSetItem(key: string, value: string, storage: Storage = localStorage): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch (err) {
    storageError('setItem failed', err, key);
    return false;
  }
}

export function safeRemoveItem(key: string, storage: Storage = localStorage): void {
  try {
    storage.removeItem(key);
  } catch (err) {
    storageError('removeItem failed', err, key);
  }
}

/** Parse JSON string; log and return fallback on failure. */
export function safeParseJson<T>(raw: string, fallback: T, context: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    storageError(`JSON.parse: ${context}`, err);
    return fallback;
  }
}

/** Read + parse from storage; remove key and return fallback if corrupt. */
export function safeLoadJson<T>(
  key: string,
  fallback: T,
  context: string,
  storage: Storage = localStorage
): T {
  const raw = safeGetItem(key, storage);
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    storageError(`JSON.parse: ${context}`, err, key);
    safeRemoveItem(key, storage);
    return fallback;
  }
}

const STORAGE_PREFIXES = ['cat-calendar-', 'cat-ai-', 'ai-usage-', 'weekly-ai-report-', 'vet-report-ai-usage-'];

function isAppStorageKey(key: string): boolean {
  return STORAGE_PREFIXES.some((p) => key.startsWith(p)) || key === 'cat-calendar-reminders';
}

/** On boot: drop keys whose values are not valid JSON when they look like JSON blobs. */
export function repairCorruptedLocalStorage(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }
    for (const key of keys) {
      if (!isAppStorageKey(key)) continue;
      const raw = safeGetItem(key);
      if (raw == null || raw === '') continue;
      const trimmed = raw.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          JSON.parse(raw);
        } catch (err) {
          storageError('repair: removed corrupt entry', err, key);
          safeRemoveItem(key);
        }
      }
    }
  } catch (err) {
    storageError('repairCorruptedLocalStorage failed', err);
  }
}
