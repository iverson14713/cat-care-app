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
import { insertCatForOwner, isCloudCatId, type AppCat } from './supabaseCats';
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
  listLocalWeeklyReportsForCat,
  loadSavedWeeklyReport,
  type SavedWeeklyReport,
  weeklyReportStorageKey,
} from './weeklyReportStorage';

export function dailyStorageKey(catId: string, date: string): string {
  return `cat-calendar-daily-${catId}-${date}`;
}

export function monthlyStorageKey(catId: string, month: string): string {
  return `cat-calendar-monthly-${catId}-${month}`;
}

export function weightStorageKey(catId: string): string {
  return `cat-calendar-weights-${catId}`;
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

function listLocalMonthlyKeysForCat(catId: string): string[] {
  const prefix = `cat-calendar-monthly-${catId}-`;
  const months: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) months.push(key.slice(prefix.length));
    }
  } catch {
    // ignore
  }
  return months;
}

function parseLocalDaily(catId: string, date: string): DailyJson {
  const raw = safeGetItem(dailyStorageKey(catId, date));
  if (!raw) return {};
  try {
    const p = JSON.parse(raw) as DailyJson;
    return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  } catch {
    return {};
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
  try {
    const prefix = `weekly-ai-report-${catId}-`;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) keys.push(k);
    }
    for (const k of keys) safeRemoveItem(k);
  } catch {
    // ignore
  }
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
    const prefix = `weekly-ai-report-${oldId}-`;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) keys.push(k);
    }
    for (const k of keys) {
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
  localCats: AppCat[]
): Promise<{ cats: AppCat[]; idMap: Record<string, string>; errors: string[] }> {
  const idMap: Record<string, string> = {};
  const errors: string[] = [];
  const cats: AppCat[] = [];

  for (const cat of localCats) {
    if (isCloudCatId(cat.id)) {
      cats.push(cat);
      continue;
    }
    const { data, error } = await insertCatForOwner(supabase, userId, cat);
    if (error || !data) {
      errors.push(`migrate ${cat.name}: ${error?.message ?? 'unknown'}`);
      cats.push(cat);
      continue;
    }
    rewriteCatStorageKeys(cat.id, data.id);
    idMap[cat.id] = data.id;
    cats.push(data);
  }

  return { cats, idMap, errors };
}

export type SyncPullResult = {
  dailyDates: number;
  weights: number;
  months: number;
  reminders: number;
  photoDates: number;
  weeklyReports: number;
  errors: string[];
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
  const errors: string[] = [];
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
    if (photoErr) errors.push(`photos ${catId}: ${photoErr.message}`);
    else {
      for (const row of photoRows) {
        photoByDate.set(row.record_date, {
          abnormalPhotos: row.abnormal_photos,
          dailyPhotos: row.daily_photos,
        });
        photoDates += 1;
      }
    }

    const { data: dailyRows, error: dailyErr } = await fetchAllDailyRecordsForCat(supabase, catId);
    if (dailyErr) errors.push(`daily ${catId}: ${dailyErr.message}`);
    else {
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
    if (weightErr) errors.push(`weight ${catId}: ${weightErr.message}`);
    else {
      let localWeights: AppWeightRecord[] = [];
      const raw = safeGetItem(weightStorageKey(catId));
      if (raw) {
        try {
          const p = JSON.parse(raw);
          if (Array.isArray(p)) localWeights = p as AppWeightRecord[];
        } catch {
          /* ignore */
        }
      }
      const merged = mergeWeightRecords(weightRows, localWeights);
      safeSetItem(weightStorageKey(catId), JSON.stringify(merged));
      weights += merged.length;
    }

    const { data: monthRows, error: monthErr } = await fetchMonthlyRecordsForCat(supabase, catId);
    if (monthErr) errors.push(`monthly ${catId}: ${monthErr.message}`);
    else {
      for (const row of monthRows) {
        safeSetItem(monthlyStorageKey(catId, row.monthKey), JSON.stringify(row.data));
        months += 1;
      }
    }

    const { data: cloudWeeklies, error: weekErr } = await fetchWeeklyReportsForCat(supabase, catId);
    if (weekErr) errors.push(`weekly ${catId}: ${weekErr.message}`);
    else {
      for (const cloud of cloudWeeklies) {
        const local = loadSavedWeeklyReport(catId, cloud.weekEnd);
        const pick = mergeWeeklyBySavedAt(cloud, local);
        safeSetItem(weeklyReportStorageKey(catId, cloud.weekEnd), JSON.stringify(pick));
        weeklyReports += 1;
      }
    }

  }

  const { data: cloudReminders, error: remErr } = await fetchUserReminders(supabase, userId);
  if (remErr) errors.push(`reminders: ${remErr.message}`);
  else {
    const raw = safeGetItem('cat-calendar-reminders');
    let localReminders: Reminder[] = [];
    if (raw) {
      try {
        const p = JSON.parse(raw);
        if (Array.isArray(p)) localReminders = p as Reminder[];
      } catch {
        /* ignore */
      }
    }
    const merged = mergeReminders(cloudReminders, localReminders);
    safeSetItem('cat-calendar-reminders', JSON.stringify(merged));
    reminders = merged.length;
  }

  const clientId = getOrCreateClientId();
  const localDaily = readLocalAiUsageCount(clientId, usageDate);
  const { data: cloudUsage, error: usageErr } = await fetchUserAiUsage(supabase, userId, usageDate);
  if (usageErr) errors.push(`ai usage: ${usageErr.message}`);
  else {
    const mergedDaily = Math.max(cloudUsage?.daily_used ?? 0, localDaily);
    writeLocalAiUsageCount(clientId, usageDate, mergedDaily);
  }

  const localPlan = getAiPlan();
  const { plan: cloudPlan, error: planErr } = await fetchUserAiPlan(supabase, userId);
  if (planErr) errors.push(`ai plan: ${planErr.message}`);
  else {
    const mergedPlan = mergeAiPlan(cloudPlan, localPlan);
    setAiPlan(mergedPlan);
  }

  return { dailyDates, weights, months, reminders, photoDates, weeklyReports, errors };
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
): Promise<string[]> {
  const errors: string[] = [];

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
        if (error) errors.push(`daily upsert ${catId} ${date}: ${error.message}`);
      }
      if (hasDailyPhotos(localFull)) {
        const { error } = await upsertDailyPhotosCloud(supabase, {
          catId,
          recordDate: date,
          abnormalPhotos: getPhotoList(localFull.abnormalPhotos),
          dailyPhotos: getPhotoList(localFull.dailyPhotos),
          updatedBy: userId,
        });
        if (error) errors.push(`photos upsert ${catId} ${date}: ${error.message}`);
      }
    }

    const rawW = safeGetItem(weightStorageKey(catId));
    if (rawW) {
      try {
        const parsed = JSON.parse(rawW) as AppWeightRecord[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const { error, records } = await upsertWeightRecordsForCat(supabase, catId, parsed, userId);
          if (error) {
            errors.push(`weight upsert ${catId}: ${error.message}`);
          } else {
            clearWeightsPendingSync(catId);
            if (records.length > 0) {
              safeSetItem(weightStorageKey(catId), JSON.stringify(records));
            }
          }
        }
      } catch {
        /* ignore */
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
        if (error) errors.push(`monthly upsert ${catId} ${monthKey}: ${error.message}`);
      } catch {
        /* ignore */
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
      if (error) errors.push(`weekly upsert ${catId} ${saved.weekEnd}: ${error.message}`);
    }

  }

  const { error: remUpErr } = await upsertUserReminders(supabase, userId, localReminders);
  if (remUpErr) errors.push(`reminders upsert: ${remUpErr.message}`);

  const clientId = getOrCreateClientId();
  const dailyUsed = readLocalAiUsageCount(clientId, usageDate);
  const { error: usageUpErr } = await upsertUserAiUsage(supabase, userId, usageDate, dailyUsed, 0);
  if (usageUpErr) errors.push(`ai usage upsert: ${usageUpErr.message}`);

  const plan: AiPlan = getAiPlan();
  const { error: planUpErr } = await upsertUserAiPlan(supabase, userId, plan);
  if (planUpErr) errors.push(`ai plan upsert: ${planUpErr.message}`);

  return errors;
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
