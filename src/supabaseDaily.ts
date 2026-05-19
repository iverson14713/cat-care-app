import type { SupabaseClient } from '@supabase/supabase-js';
import { getPhotoList, mergePhotoArrays } from './supabasePhotos';

export type DailyJson = Record<string, unknown>;

/** Strip before saving to `daily_records.data` (photos live in `daily_record_photos`). */
export function stripPhotoFieldsFromDaily(daily: DailyJson): DailyJson {
  const { abnormalPhotos: _a, dailyPhotos: _d, ...rest } = daily;
  return rest;
}

/** Cloud daily fields overwrite local; photo arrays union cloud + local. */
export function mergeCloudDailyPreferCloud(cloudPart: DailyJson | null | undefined, localFull: DailyJson): DailyJson {
  const c = cloudPart && typeof cloudPart === 'object' && !Array.isArray(cloudPart) ? cloudPart : {};
  const out: DailyJson = { ...localFull, ...c };
  out.abnormalPhotos = mergePhotoArrays(getPhotoList(c.abnormalPhotos), getPhotoList(localFull.abnormalPhotos));
  out.dailyPhotos = mergePhotoArrays(getPhotoList(c.dailyPhotos), getPhotoList(localFull.dailyPhotos));
  return out;
}

export type DailyRecordRow = {
  record_date: string;
  data: DailyJson;
  updated_at?: string;
};

export async function fetchAllDailyRecordsForCat(
  supabase: SupabaseClient,
  catId: string,
  limit = 400
): Promise<{ data: DailyRecordRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('daily_records')
    .select('record_date, data, updated_at')
    .eq('cat_id', catId)
    .order('record_date', { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: new Error(error.message) };
  const rows = (data ?? []) as { record_date: string; data: unknown; updated_at?: string }[];
  return {
    data: rows
      .filter((r) => typeof r.record_date === 'string')
      .map((r) => ({
        record_date: r.record_date,
        data:
          r.data && typeof r.data === 'object' && !Array.isArray(r.data) ? (r.data as DailyJson) : {},
        updated_at: r.updated_at,
      })),
    error: null,
  };
}

export async function fetchDailyRecordRow(
  supabase: SupabaseClient,
  catId: string,
  recordDate: string
): Promise<{ data: DailyJson | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('daily_records')
    .select('data')
    .eq('cat_id', catId)
    .eq('record_date', recordDate)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  const raw = data?.data;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { data: raw as DailyJson, error: null };
  }
  return { data: null, error: null };
}

export async function upsertDailyRecordCloud(
  supabase: SupabaseClient,
  params: { catId: string; recordDate: string; data: DailyJson; updatedBy: string }
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('daily_records').upsert(
    {
      cat_id: params.catId,
      record_date: params.recordDate,
      data: params.data,
      updated_by: params.updatedBy,
    },
    { onConflict: 'cat_id,record_date' }
  );
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export type CareEventRow = {
  id: string;
  cat_id: string;
  actor: string;
  action: string;
  summary: string;
  created_at: string;
};

export async function insertCareEventRow(
  supabase: SupabaseClient,
  params: { catId: string; actor: string; action: string; summary: string }
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('care_events').insert({
    cat_id: params.catId,
    actor: params.actor,
    action: params.action,
    summary: params.summary,
  });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function fetchCareEventsForCat(
  supabase: SupabaseClient,
  catId: string,
  limit = 80
): Promise<{ data: CareEventRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('care_events')
    .select('id, cat_id, actor, action, summary, created_at')
    .eq('cat_id', catId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as CareEventRow[], error: null };
}

export function careEventCreatedOnLocalDate(createdAtIso: string, localYmd: string): boolean {
  const d = new Date(createdAtIso);
  if (Number.isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}` === localYmd;
}

export function formatCareEventTimeLabel(createdAtIso: string): string {
  const d = new Date(createdAtIso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
