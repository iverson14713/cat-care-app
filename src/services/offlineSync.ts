import type { SupabaseClient } from '@supabase/supabase-js';
import { dailyStorageKey, weightStorageKey } from '../cloudDataSync';
import {
  stripPhotoFieldsFromDaily,
  upsertDailyRecordCloud,
  type DailyJson,
} from '../supabaseDaily';
import { upsertDailyPhotosCloud, getPhotoList } from '../supabasePhotos';
import { upsertWeightRecordsForCat, type AppWeightRecord } from '../supabaseWeight';
import { isCloudCatId } from '../supabaseCats';
import { safeGetItem, safeSetItem } from '../safeStorage';

export const PENDING_SYNC_KEY = 'pending_sync';

export type DailyRecordWithSync = DailyJson & { pending_sync?: boolean };

export type WeightRecordWithSync = AppWeightRecord & { pendingSync?: boolean };

export function readIsOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export function subscribeOnlineStatus(onChange: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = () => onChange(readIsOnline());
  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);
  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
  };
}

export function stripSyncMetaFromDaily(data: DailyJson): DailyJson {
  const copy = { ...data } as DailyRecordWithSync;
  delete copy.pending_sync;
  return stripPhotoFieldsFromDaily(copy);
}

function parseLocalDailyRaw(catId: string, date: string): DailyRecordWithSync {
  const raw = safeGetItem(dailyStorageKey(catId, date));
  if (!raw) return {};
  try {
    const p = JSON.parse(raw) as DailyRecordWithSync;
    return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
}

function listLocalDailyDatesForCat(catId: string): string[] {
  const prefix = `cat-calendar-daily-${catId}-`;
  const dates: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) dates.push(key.slice(prefix.length));
    }
  } catch {
    // ignore
  }
  return dates;
}

function hasDailyContent(data: DailyJson): boolean {
  return Object.keys(stripPhotoFieldsFromDaily(data)).length > 0;
}

function hasDailyPhotos(data: DailyJson): boolean {
  return getPhotoList(data.abnormalPhotos).length > 0 || getPhotoList(data.dailyPhotos).length > 0;
}

export function applyDailyPendingSync(
  daily: DailyJson,
  shouldMark: boolean
): DailyRecordWithSync {
  if (!shouldMark) {
    const copy = { ...daily } as DailyRecordWithSync;
    delete copy.pending_sync;
    return copy;
  }
  return { ...daily, pending_sync: true };
}

export function markDailyPendingSync(catId: string, date: string): void {
  const current = parseLocalDailyRaw(catId, date);
  safeSetItem(dailyStorageKey(catId, date), JSON.stringify({ ...current, pending_sync: true }));
}

export function clearDailyPendingSync(catId: string, date: string): void {
  const current = parseLocalDailyRaw(catId, date);
  if (!current.pending_sync) return;
  const next = { ...current };
  delete next.pending_sync;
  safeSetItem(dailyStorageKey(catId, date), JSON.stringify(next));
}

export function markWeightsPendingSync(catId: string): void {
  const raw = safeGetItem(weightStorageKey(catId));
  if (!raw) return;
  try {
    const rows = JSON.parse(raw) as WeightRecordWithSync[];
    if (!Array.isArray(rows)) return;
    const next = rows.map((r) => ({ ...r, pendingSync: true }));
    safeSetItem(weightStorageKey(catId), JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function clearWeightsPendingSync(catId: string): void {
  const raw = safeGetItem(weightStorageKey(catId));
  if (!raw) return;
  try {
    const rows = JSON.parse(raw) as WeightRecordWithSync[];
    if (!Array.isArray(rows)) return;
    const next = rows.map((r) => {
      const copy = { ...r };
      delete copy.pendingSync;
      return copy;
    });
    safeSetItem(weightStorageKey(catId), JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function countPendingSyncItems(cloudCatIds: string[]): number {
  let n = 0;
  for (const catId of cloudCatIds) {
    for (const date of listLocalDailyDatesForCat(catId)) {
      if (parseLocalDailyRaw(catId, date).pending_sync) n += 1;
    }
    const raw = safeGetItem(weightStorageKey(catId));
    if (!raw) continue;
    try {
      const rows = JSON.parse(raw) as WeightRecordWithSync[];
      if (Array.isArray(rows) && rows.some((r) => r.pendingSync)) n += 1;
    } catch {
      // ignore
    }
  }
  return n;
}

export type FlushPendingSyncResult = {
  ok: boolean;
  syncedDaily: number;
  syncedWeights: number;
  errors: string[];
};

/**
 * Push locally saved records marked pending_sync to Supabase.
 */
export async function flushPendingSync(
  supabase: SupabaseClient,
  userId: string,
  cloudCatIds: string[]
): Promise<FlushPendingSyncResult> {
  const errors: string[] = [];
  let syncedDaily = 0;
  let syncedWeights = 0;

  for (const catId of cloudCatIds) {
    if (!isCloudCatId(catId)) continue;

    for (const date of listLocalDailyDatesForCat(catId)) {
      const localFull = parseLocalDailyRaw(catId, date);
      if (!localFull.pending_sync) continue;

      const strip = stripSyncMetaFromDaily(localFull);
      if (hasDailyContent(strip)) {
        const { error } = await upsertDailyRecordCloud(supabase, {
          catId,
          recordDate: date,
          data: strip,
          updatedBy: userId,
        });
        if (error) {
          errors.push(`daily ${catId} ${date}: ${error.message}`);
          continue;
        }
      }

      if (hasDailyPhotos(localFull)) {
        const { error } = await upsertDailyPhotosCloud(supabase, {
          catId,
          recordDate: date,
          abnormalPhotos: getPhotoList(localFull.abnormalPhotos),
          dailyPhotos: getPhotoList(localFull.dailyPhotos),
          updatedBy: userId,
        });
        if (error) {
          errors.push(`photos ${catId} ${date}: ${error.message}`);
          continue;
        }
      }

      clearDailyPendingSync(catId, date);
      syncedDaily += 1;
    }

    const rawW = safeGetItem(weightStorageKey(catId));
    if (rawW) {
      try {
        const rows = JSON.parse(rawW) as WeightRecordWithSync[];
        if (Array.isArray(rows) && rows.some((r) => r.pendingSync)) {
          const cleaned: AppWeightRecord[] = rows.map(({ pendingSync: _p, ...r }) => r);
          const { error, records } = await upsertWeightRecordsForCat(supabase, catId, cleaned, userId);
          if (error) {
            errors.push(`weight ${catId}: ${error.message}`);
          } else {
            clearWeightsPendingSync(catId);
            if (records.length > 0) {
              safeSetItem(weightStorageKey(catId), JSON.stringify(records));
            }
            syncedWeights += 1;
          }
        }
      } catch {
        errors.push(`weight ${catId}: parse error`);
      }
    }
  }

  return { ok: errors.length === 0, syncedDaily, syncedWeights, errors };
}
