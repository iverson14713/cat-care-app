import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchAllDailyRecordsForCat,
  mergeCloudDailyPreferCloud,
  stripPhotoFieldsFromDaily,
  upsertDailyRecordCloud,
  type DailyJson,
} from './supabaseDaily';
import { fetchMonthlyRecordsForCat, upsertMonthlyRecordCloud } from './supabaseMonthly';
import {
  fetchWeightRecordsForCat,
  mergeWeightRecords,
  upsertWeightRecordsForCat,
  type AppWeightRecord,
} from './supabaseWeight';
import { fetchUserReminders, mergeReminders, upsertUserReminders } from './supabaseReminders';
import type { Reminder } from './reminders';
import {
  ensureDefaultPetForUser,
  fetchCatsForUser,
  insertCatForOwner,
  isCloudCatId,
  type AppCat,
} from './supabaseCats';
import { isOfflineAutoPlaceholderPet, logDefaultPetDecision, stripOfflinePlaceholdersWhenUserHasPets } from './defaultPet';
import { dedupeDuplicateDefaultPetsOnCloud } from './petDedupe';
import { clearWeightsPendingSync } from './services/offlineSync';
import { safeGetItem, safeRemoveItem, safeSetItem } from './safeStorage';
import {
  fetchAllDailyPhotosForCat,
  getPhotoList,
  upsertDailyPhotosCloud,
} from './supabasePhotos';
import { fetchWeeklyReportsForCat, upsertWeeklyReportCloud } from './supabaseWeeklyReports';
import { fetchUserAiUsage, upsertUserAiUsage } from './supabaseAiUsage';
import { fetchUserAiPlan, mergeAiPlan, upsertUserAiPlan, type AiPlan } from './supabaseUserPrefs';
import {
  getOrCreateClientId,
  getAiPlan,
  readLocalAiUsageCount,
  setAiPlan,
  writeLocalAiUsageCount,
} from './aiClient';
import {
  assertStorageOwnerMatches,
  dailyStorageKey,
  getActiveStorageUserId,
  listLocalDailyDatesForCat,
  listLocalMonthlyKeysForCat,
  monthlyStorageKey,
  remindersStorageKey,
  weightStorageKey,
  weeklyReportStorageKey,
} from './userStorageScope';
import {
  listLocalWeeklyReportsForCat,
  loadSavedWeeklyReport,
  type SavedWeeklyReport,
} from './weeklyReportStorage';
import {
  logSyncIssue,
  makeSyncIssue,
  type SyncIssue,
} from './cloudSyncErrors';
import type { DbError } from './supabaseError';

export {
  dailyStorageKey,
  monthlyStorageKey,
  weightStorageKey,
  weeklyReportStorageKey,
} from './userStorageScope';

function parseLocalDaily(catId: string, date: string): DailyJson {
  const raw = safeGetItem(dailyStorageKey(catId, date));
  if (!raw) return {};
  try {
    const p = JSON.parse(raw) as DailyJson;
    if (p && typeof p === 'object' && !Array.isArray(p)) return p;
    console.warn('[cloud-sync] invalid local daily JSON', {
      table: 'localStorage',
      action: 'select',
      catId,
      recordKey: date,
    });
    return {};
  } catch (e) {
    console.warn('[cloud-sync] corrupt local daily JSON', {
      table: 'localStorage',
      action: 'select',
      catId,
      recordKey: date,
      message: e instanceof Error ? e.message : String(e),
    });
    return {};
  }
}

function appendDbError(
  issues: SyncIssue[],
  params: {
    table: string;
    action: SyncIssue['action'];
    error: DbError | null;
    catId?: string;
    recordKey?: string;
    source: SyncIssue['source'];
  }
): void {
  if (!params.error) return;
  const issue = makeSyncIssue({
    table: params.table,
    action: params.action,
    error: params.error,
    catId: params.catId,
    recordKey: params.recordKey,
    source: params.source,
  });
  logSyncIssue(issue);
  issues.push(issue);
}

function parseLocalWeightRecords(catId: string): AppWeightRecord[] {
  const raw = safeGetItem(weightStorageKey(catId));
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (!Array.isArray(p)) {
      console.warn('[cloud-sync] invalid local weight JSON (not array)', {
        table: 'localStorage',
        action: 'select',
        catId,
        storageKey: weightStorageKey(catId),
      });
      return [];
    }
    return p.filter(
      (r): r is AppWeightRecord =>
        r &&
        typeof r === 'object' &&
        typeof (r as AppWeightRecord).date === 'string' &&
        Number.isFinite(Number((r as AppWeightRecord).weight))
    );
  } catch (e) {
    console.warn('[cloud-sync] corrupt local weight JSON', {
      table: 'localStorage',
      action: 'select',
      catId,
      storageKey: weightStorageKey(catId),
      message: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

function parseLocalReminders(userId: string): Reminder[] {
  const raw = safeGetItem(remindersStorageKey(userId));
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (!Array.isArray(p)) {
      console.warn('[cloud-sync] invalid local reminders JSON', {
        table: 'localStorage',
        action: 'select',
        recordKey: userId,
      });
      return [];
    }
    return p as Reminder[];
  } catch (e) {
    console.warn('[cloud-sync] corrupt local reminders JSON', {
      table: 'localStorage',
      action: 'select',
      recordKey: userId,
      message: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

function writeMergedDailyToLocal(
  catId: string,
  date: string,
  cloudPart: DailyJson | null,
  cloudPhotos?: { abnormalPhotos: string[]; dailyPhotos: string[] }
): DailyJson {
  const localFull = parseLocalDaily(catId, date);
  let merged = mergeCloudDailyPreferCloud(cloudPart, localFull);
  if (cloudPhotos) {
    merged = {
      ...merged,
      abnormalPhotos: [...new Set([...cloudPhotos.abnormalPhotos, ...getPhotoList(localFull.abnormalPhotos)])],
      dailyPhotos: [...new Set([...cloudPhotos.dailyPhotos, ...getPhotoList(localFull.dailyPhotos)])],
    };
  }
  safeSetItem(dailyStorageKey(catId, date), JSON.stringify(merged));
  return merged;
}

function hasDailyContent(data: DailyJson): boolean {
  return Object.keys(stripPhotoFieldsFromDaily(data)).length > 0;
}

function hasDailyPhotos(data: DailyJson): boolean {
  return getPhotoList(data.abnormalPhotos).length > 0 || getPhotoList(data.dailyPhotos).length > 0;
}

function mergeWeeklyBySavedAt(cloud: SavedWeeklyReport, local: SavedWeeklyReport | null): SavedWeeklyReport {
  if (!local) return cloud;
  const c = new Date(cloud.savedAt).getTime();
  const l = new Date(local.savedAt).getTime();
  return (Number.isFinite(c) && c >= l) || !Number.isFinite(l) ? cloud : local;
}

/** Remove all local data keys for a cat (after permanent delete). */
export function purgeCatLocalStorage(catId: string): void {
  for (const date of listLocalDailyDatesForCat(catId)) {
    safeRemoveItem(dailyStorageKey(catId, date));
  }
  for (const monthKey of listLocalMonthlyKeysForCat(catId)) {
    safeRemoveItem(monthlyStorageKey(catId, monthKey));
  }
  safeRemoveItem(weightStorageKey(catId));
  const uid = getActiveStorageUserId();
  const prefix = `weekly-ai-report-${uid}-${catId}-`;
  for (const key of listKeysForPrefix(prefix)) {
    safeRemoveItem(key);
  }
}

function listKeysForPrefix(prefix: string): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) keys.push(k);
    }
  } catch {
    // ignore
  }
  return keys;
}

/** Rewrite localStorage keys when an offline cat receives a cloud UUID. */
export function rewriteCatStorageKeys(oldId: string, newId: string): void {
  for (const date of listLocalDailyDatesForCat(oldId)) {
    const v = safeGetItem(dailyStorageKey(oldId, date));
    if (v) {
      safeSetItem(dailyStorageKey(newId, date), v);
      safeRemoveItem(dailyStorageKey(oldId, date));
    }
  }
  for (const monthKey of listLocalMonthlyKeysForCat(oldId)) {
    const key = monthlyStorageKey(oldId, monthKey);
    const v = safeGetItem(key);
    if (v) {
      safeSetItem(monthlyStorageKey(newId, monthKey), v);
      safeRemoveItem(key);
    }
  }
  const wKey = weightStorageKey(oldId);
  const w = safeGetItem(wKey);
  if (w) {
    safeSetItem(weightStorageKey(newId), w);
    safeRemoveItem(wKey);
  }
  try {
    const uid = getActiveStorageUserId();
    const prefix = `weekly-ai-report-${uid}-${oldId}-`;
    for (const k of listKeysForPrefix(prefix)) {
      const weekEnd = k.slice(prefix.length);
      const v = safeGetItem(k);
      if (v) {
        safeSetItem(weeklyReportStorageKey(newId, weekEnd), v);
        safeRemoveItem(k);
      }
    }
  } catch {
    // ignore
  }
}

/** Upload offline-only cats to Supabase and remap local keys to new UUIDs. */
export async function migrateOfflineCatsToCloud(
  supabase: SupabaseClient,
  userId: string,
  localCats: AppCat[],
  options?: { existingCloudCats?: AppCat[] }
): Promise<{ cats: AppCat[]; idMap: Record<string, string>; errors: string[] }> {
  const ownerCheck = assertStorageOwnerMatches(userId);
  if (!ownerCheck.ok) {
    return {
      cats: localCats.filter((c) => isCloudCatId(c.id)),
      idMap: {},
      errors: ['storage_owner_mismatch: local data belongs to another account'],
    };
  }

  let cloudList = options?.existingCloudCats;
  if (!cloudList) {
    const fetched = await fetchCatsForUser(supabase);
    if (fetched.error) {
      return { cats: localCats.filter((c) => isCloudCatId(c.id)), idMap: {}, errors: [fetched.error.message] };
    }
    cloudList = fetched.data;
  }
  const cloudCount = cloudList.length;

  console.log('[pets] migrateOfflineCatsToCloud', {
    userId: userId.slice(0, 8),
    cloudCount,
    localCount: localCats.length,
    offlineCount: localCats.filter((c) => !isCloudCatId(c.id)).length,
  });

  const idMap: Record<string, string> = {};
  const errors: string[] = [];
  const cats: AppCat[] = [...cloudList];

  for (const cat of localCats) {
    if (isCloudCatId(cat.id)) {
      if (!cats.some((c) => c.id === cat.id)) cats.push(cat);
      continue;
    }
    if (cloudCount > 0 && isOfflineAutoPlaceholderPet(cat)) {
      logDefaultPetDecision({
        userId,
        cloudCount,
        localCount: localCats.length,
        action: 'skip_placeholder_migrate',
        detail: `skipped placeholder ${cat.id} (${cat.name})`,
      });
      continue;
    }
    const rawOwner =
      (typeof cat.ownerId === 'string' && cat.ownerId) ||
      (typeof (cat as { owner_id?: string }).owner_id === 'string' && (cat as { owner_id?: string }).owner_id) ||
      '';
    if (rawOwner && rawOwner !== userId) {
      errors.push(`skip migrate ${cat.name}: owned by another user`);
      continue;
    }
    const { data, error } = await insertCatForOwner(supabase, userId, cat);
    if (error || !data) {
      errors.push(`migrate ${cat.name}: ${error?.message ?? 'unknown'}`);
      continue;
    }
    rewriteCatStorageKeys(cat.id, data.id);
    idMap[cat.id] = data.id;
    cats.push(data);
  }

  return { cats, idMap, errors };
}

export type ReconcileCloudPetsResult = {
  cloudList: AppCat[];
  idMap: Record<string, string>;
  errors: string[];
};

/**
 * Login / bootstrap pet pipeline: migrate real offline pets, ensure one default if empty, dedupe duplicates.
 */
export async function reconcileCloudPetsForUser(
  supabase: SupabaseClient,
  userId: string,
  localCats: AppCat[],
  preferredCatId?: string
): Promise<ReconcileCloudPetsResult> {
  const errors: string[] = [];
  let idMap: Record<string, string> = {};

  const strippedLocal = stripOfflinePlaceholdersWhenUserHasPets(
    localCats.map((c) => ({ id: c.id, name: c.name, petType: c.petType, emoji: c.emoji }))
  );
  const localForMigrate = localCats.filter((c) =>
    strippedLocal.some((s) => s.id === c.id)
  );

  let { data: cloudList, error: fetchErr } = await fetchCatsForUser(supabase);
  if (fetchErr) {
    return { cloudList: [], idMap: {}, errors: [fetchErr.message] };
  }

  console.log('[pets] reconcileCloudPetsForUser start', {
    userId: userId.slice(0, 8),
    cloudCount: cloudList.length,
    localCount: localCats.length,
  });

  const mig = await migrateOfflineCatsToCloud(supabase, userId, localForMigrate, {
    existingCloudCats: cloudList,
  });
  idMap = { ...idMap, ...mig.idMap };
  errors.push(...mig.errors);

  const refetch1 = await fetchCatsForUser(supabase);
  if (refetch1.error) {
    errors.push(refetch1.error.message);
    return { cloudList, idMap, errors };
  }
  cloudList = refetch1.data;

  if (cloudList.length === 0) {
    const ensured = await ensureDefaultPetForUser(supabase, userId);
    if (ensured.error) errors.push(ensured.error.message);
    const refetch2 = await fetchCatsForUser(supabase);
    if (!refetch2.error) cloudList = refetch2.data;
  } else {
    const dedupe = await dedupeDuplicateDefaultPetsOnCloud(
      supabase,
      userId,
      cloudList,
      preferredCatId && isCloudCatId(preferredCatId) ? preferredCatId : undefined
    );
    errors.push(...dedupe.errors);
    if (dedupe.removedIds.length > 0 || dedupe.mergedIds.length > 0) {
      const refetch3 = await fetchCatsForUser(supabase);
      if (!refetch3.error) cloudList = refetch3.data;
    }
  }

  console.log('[pets] reconcileCloudPetsForUser done', {
    userId: userId.slice(0, 8),
    cloudCount: cloudList.length,
    migrated: Object.keys(idMap).length,
  });

  return { cloudList, idMap, errors };
}

export type SyncPullResult = {
  dailyDates: number;
  weights: number;
  months: number;
  reminders: number;
  photoDates: number;
  weeklyReports: number;
  issues: SyncIssue[];
};

/**
 * Pull cloud → local for all cloud cats (cloud wins except merged photos).
 * Call before any cloud upsert on login / refresh.
 */
export async function pullCloudDataIntoLocal(
  supabase: SupabaseClient,
  userId: string,
  cloudCatIds: string[],
  usageDate: string
): Promise<SyncPullResult> {
  const issues: SyncIssue[] = [];
  let dailyDates = 0;
  let weights = 0;
  let months = 0;
  let reminders = 0;
  let photoDates = 0;
  let weeklyReports = 0;

  for (const catId of cloudCatIds) {
    if (!isCloudCatId(catId)) continue;

    const photoByDate = new Map<string, { abnormalPhotos: string[]; dailyPhotos: string[] }>();
    const { data: photoRows, error: photoErr } = await fetchAllDailyPhotosForCat(supabase, catId);
    appendDbError(issues, {
      table: 'daily_record_photos',
      action: 'select',
      error: photoErr,
      catId,
      source: 'pull',
    });
    if (!photoErr) {
      for (const row of photoRows) {
        photoByDate.set(row.record_date, {
          abnormalPhotos: row.abnormal_photos,
          dailyPhotos: row.daily_photos,
        });
        photoDates += 1;
      }
    }

    const { data: dailyRows, error: dailyErr } = await fetchAllDailyRecordsForCat(supabase, catId);
    appendDbError(issues, {
      table: 'daily_records',
      action: 'select',
      error: dailyErr,
      catId,
      source: 'pull',
    });
    if (!dailyErr) {
      const datesDone = new Set<string>();
      for (const row of dailyRows) {
        writeMergedDailyToLocal(catId, row.record_date, row.data, photoByDate.get(row.record_date));
        datesDone.add(row.record_date);
        dailyDates += 1;
      }
      for (const [date, photos] of photoByDate) {
        if (datesDone.has(date)) continue;
        if (photos.abnormalPhotos.length === 0 && photos.dailyPhotos.length === 0) continue;
        writeMergedDailyToLocal(catId, date, null, photos);
      }
    }

    const { data: weightRows, error: weightErr } = await fetchWeightRecordsForCat(supabase, catId);
    appendDbError(issues, {
      table: 'weight_records',
      action: 'select',
      error: weightErr,
      catId,
      source: 'pull',
    });
    if (!weightErr) {
      const localWeights = parseLocalWeightRecords(catId);
      const merged = mergeWeightRecords(weightRows, localWeights);
      safeSetItem(weightStorageKey(catId), JSON.stringify(merged));
      weights += merged.length;
    }

    const { data: monthRows, error: monthErr } = await fetchMonthlyRecordsForCat(supabase, catId);
    appendDbError(issues, {
      table: 'monthly_records',
      action: 'select',
      error: monthErr,
      catId,
      source: 'pull',
    });
    if (!monthErr) {
      for (const row of monthRows) {
        safeSetItem(monthlyStorageKey(catId, row.monthKey), JSON.stringify(row.data));
        months += 1;
      }
    }

    const { data: cloudWeeklies, error: weekErr } = await fetchWeeklyReportsForCat(supabase, catId);
    appendDbError(issues, {
      table: 'weekly_reports',
      action: 'select',
      error: weekErr,
      catId,
      source: 'pull',
    });
    if (!weekErr) {
      for (const cloud of cloudWeeklies) {
        const local = loadSavedWeeklyReport(catId, cloud.weekEnd);
        const pick = mergeWeeklyBySavedAt(cloud, local);
        safeSetItem(weeklyReportStorageKey(catId, cloud.weekEnd), JSON.stringify(pick));
        weeklyReports += 1;
      }
    }

  }

  const { data: cloudReminders, error: remErr } = await fetchUserReminders(supabase, userId);
  appendDbError(issues, {
    table: 'user_reminders',
    action: 'select',
    error: remErr,
    source: 'pull',
  });
  if (!remErr) {
    const localReminders = parseLocalReminders(userId);
    const merged = mergeReminders(cloudReminders, localReminders);
    safeSetItem(remindersStorageKey(userId), JSON.stringify(merged));
    reminders = merged.length;
  }

  const clientId = getOrCreateClientId();
  const localDaily = readLocalAiUsageCount(clientId, usageDate);
  const { data: cloudUsage, error: usageErr } = await fetchUserAiUsage(supabase, userId, usageDate);
  appendDbError(issues, {
    table: 'user_ai_usage',
    action: 'select',
    error: usageErr,
    recordKey: usageDate,
    source: 'pull',
  });
  if (!usageErr) {
    const mergedDaily = Math.max(cloudUsage?.daily_used ?? 0, localDaily);
    writeLocalAiUsageCount(clientId, usageDate, mergedDaily);
  }

  const localPlan = getAiPlan();
  const { plan: cloudPlan, error: planErr } = await fetchUserAiPlan(supabase, userId);
  appendDbError(issues, {
    table: 'user_preferences',
    action: 'select',
    error: planErr,
    source: 'pull',
  });
  if (!planErr) {
    const mergedPlan = mergeAiPlan(cloudPlan, localPlan);
    setAiPlan(mergedPlan);
  }

  return { dailyDates, weights, months, reminders, photoDates, weeklyReports, issues };
}

/**
 * Push local-only / updated data to cloud.
 * Run after pullCloudDataIntoLocal.
 */
export async function pushLocalDataToCloud(
  supabase: SupabaseClient,
  userId: string,
  cloudCatIds: string[],
  localReminders: Reminder[],
  usageDate: string
): Promise<SyncIssue[]> {
  const issues: SyncIssue[] = [];

  for (const catId of cloudCatIds) {
    if (!isCloudCatId(catId)) continue;

    for (const date of listLocalDailyDatesForCat(catId)) {
      const localFull = parseLocalDaily(catId, date);
      if (hasDailyContent(localFull)) {
        const strip = stripPhotoFieldsFromDaily(localFull);
        const { error } = await upsertDailyRecordCloud(supabase, {
          catId,
          recordDate: date,
          data: strip,
          updatedBy: userId,
        });
        appendDbError(issues, {
          table: 'daily_records',
          action: 'upsert',
          error,
          catId,
          recordKey: date,
          source: 'push',
        });
      }
      if (hasDailyPhotos(localFull)) {
        const { error } = await upsertDailyPhotosCloud(supabase, {
          catId,
          recordDate: date,
          abnormalPhotos: getPhotoList(localFull.abnormalPhotos),
          dailyPhotos: getPhotoList(localFull.dailyPhotos),
          updatedBy: userId,
        });
        appendDbError(issues, {
          table: 'daily_record_photos',
          action: 'upsert',
          error,
          catId,
          recordKey: date,
          source: 'push',
        });
      }
    }

    const parsed = parseLocalWeightRecords(catId);
    if (parsed.length > 0) {
      const { error, records } = await upsertWeightRecordsForCat(supabase, catId, parsed, userId);
      appendDbError(issues, {
        table: 'weight_records',
        action: 'upsert',
        error,
        catId,
        source: 'push',
      });
      if (!error) {
        clearWeightsPendingSync(catId);
        if (records.length > 0) {
          safeSetItem(weightStorageKey(catId), JSON.stringify(records));
        }
      }
    }

    for (const monthKey of listLocalMonthlyKeysForCat(catId)) {
      const raw = safeGetItem(monthlyStorageKey(catId, monthKey));
      if (!raw) continue;
      try {
        const data = JSON.parse(raw) as Record<string, unknown>;
        if (!data || typeof data !== 'object') continue;
        const { error } = await upsertMonthlyRecordCloud(supabase, {
          catId,
          monthKey,
          data,
          updatedBy: userId,
        });
        appendDbError(issues, {
          table: 'monthly_records',
          action: 'upsert',
          error,
          catId,
          recordKey: monthKey,
          source: 'push',
        });
      } catch (e) {
        console.warn('[cloud-sync] corrupt local monthly JSON', {
          table: 'localStorage',
          action: 'select',
          catId,
          recordKey: monthKey,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    for (const saved of listLocalWeeklyReportsForCat(catId)) {
      const { error } = await upsertWeeklyReportCloud(supabase, {
        catId,
        weekEnd: saved.weekEnd,
        report: saved.report,
        savedAt: saved.savedAt,
        updatedBy: userId,
      });
      appendDbError(issues, {
        table: 'weekly_reports',
        action: 'upsert',
        error,
        catId,
        recordKey: saved.weekEnd,
        source: 'push',
      });
    }

  }

  const { error: remUpErr } = await upsertUserReminders(supabase, userId, localReminders);
  appendDbError(issues, {
    table: 'user_reminders',
    action: 'upsert',
    error: remUpErr,
    source: 'push',
  });

  const clientId = getOrCreateClientId();
  const dailyUsed = readLocalAiUsageCount(clientId, usageDate);
  const { error: usageUpErr } = await upsertUserAiUsage(supabase, userId, usageDate, dailyUsed, 0);
  appendDbError(issues, {
    table: 'user_ai_usage',
    action: 'upsert',
    error: usageUpErr,
    recordKey: usageDate,
    source: 'push',
  });

  const plan: AiPlan = getAiPlan();
  const { error: planUpErr } = await upsertUserAiPlan(supabase, userId, plan);
  appendDbError(issues, {
    table: 'user_preferences',
    action: 'upsert',
    error: planUpErr,
    source: 'push',
  });

  return issues;
}

/** Push one weekly report after save. */
export async function pushWeeklyReportToCloud(
  supabase: SupabaseClient,
  userId: string,
  saved: SavedWeeklyReport
): Promise<void> {
  if (!isCloudCatId(saved.catId)) return;
  const { error } = await upsertWeeklyReportCloud(supabase, {
    catId: saved.catId,
    weekEnd: saved.weekEnd,
    report: saved.report,
    savedAt: saved.savedAt,
    updatedBy: userId,
  });
  if (error) console.warn('[weekly_reports upsert]', error.message);
}

/** Sync AI usage + vet count to cloud after a successful AI call. */
export async function pushAiUsageSnapshot(
  supabase: SupabaseClient,
  userId: string,
  usageDate: string
): Promise<void> {
  const clientId = getOrCreateClientId();
  const { error } = await upsertUserAiUsage(
    supabase,
    userId,
    usageDate,
    readLocalAiUsageCount(clientId, usageDate),
    0
  );
  if (error) console.warn('[user_ai_usage upsert]', error.message);
}
