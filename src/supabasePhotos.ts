import type { SupabaseClient } from '@supabase/supabase-js';

export function getPhotoList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

/** Union photo arrays (cloud + local), dedupe by data URL string. */
export function mergePhotoArrays(cloud: string[], local: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of [...getPhotoList(cloud), ...getPhotoList(local)]) {
    if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}

export type DailyPhotosRow = {
  record_date: string;
  abnormal_photos: string[];
  daily_photos: string[];
};

export async function fetchAllDailyPhotosForCat(
  supabase: SupabaseClient,
  catId: string,
  limit = 400
): Promise<{ data: DailyPhotosRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('daily_record_photos')
    .select('record_date, abnormal_photos, daily_photos')
    .eq('cat_id', catId)
    .order('record_date', { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: new Error(error.message) };
  const rows = (data ?? []) as {
    record_date: string;
    abnormal_photos: unknown;
    daily_photos: unknown;
  }[];
  return {
    data: rows
      .filter((r) => typeof r.record_date === 'string')
      .map((r) => ({
        record_date: r.record_date,
        abnormal_photos: getPhotoList(r.abnormal_photos),
        daily_photos: getPhotoList(r.daily_photos),
      })),
    error: null,
  };
}

export async function upsertDailyPhotosCloud(
  supabase: SupabaseClient,
  params: {
    catId: string;
    recordDate: string;
    abnormalPhotos: string[];
    dailyPhotos: string[];
    updatedBy: string;
  }
): Promise<{ error: Error | null }> {
  const abnormal = getPhotoList(params.abnormalPhotos);
  const daily = getPhotoList(params.dailyPhotos);
  if (abnormal.length === 0 && daily.length === 0) return { error: null };

  const { error } = await supabase.from('daily_record_photos').upsert(
    {
      cat_id: params.catId,
      record_date: params.recordDate,
      abnormal_photos: abnormal,
      daily_photos: daily,
      updated_by: params.updatedBy,
    },
    { onConflict: 'cat_id,record_date' }
  );
  if (error) return { error: new Error(error.message) };
  return { error: null };
}
