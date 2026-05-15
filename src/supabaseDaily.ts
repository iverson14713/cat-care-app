import type { SupabaseClient } from '@supabase/supabase-js';

export type DailyJson = Record<string, unknown>;

/** Photos stay on device only; strip before saving to `daily_records.data`. */
export function stripPhotoFieldsFromDaily(daily: DailyJson): DailyJson {
  const { abnormalPhotos: _a, dailyPhotos: _d, ...rest } = daily;
  return rest;
}

/** Local-first merge: cloud fields overwrite; photo arrays always from local device. */
export function mergeCloudDailyPreferCloud(cloudPart: DailyJson | null | undefined, localFull: DailyJson): DailyJson {
  const c = cloudPart && typeof cloudPart === 'object' && !Array.isArray(cloudPart) ? cloudPart : {};
  const out: DailyJson = { ...localFull, ...c };
  out.abnormalPhotos = localFull.abnormalPhotos ?? [];
  out.dailyPhotos = localFull.dailyPhotos ?? [];
  return out;
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
