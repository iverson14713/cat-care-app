import type { SupabaseClient } from '@supabase/supabase-js';

export type MonthlyJson = Record<string, unknown>;

export async function fetchMonthlyRecordsForCat(
  supabase: SupabaseClient,
  catId: string
): Promise<{ data: { monthKey: string; data: MonthlyJson }[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('monthly_records')
    .select('month_key, data')
    .eq('cat_id', catId)
    .order('month_key', { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };
  const rows = (data ?? []) as { month_key: string; data: unknown }[];
  return {
    data: rows
      .filter((r) => typeof r.month_key === 'string')
      .map((r) => ({
        monthKey: r.month_key,
        data: r.data && typeof r.data === 'object' && !Array.isArray(r.data) ? (r.data as MonthlyJson) : {},
      })),
    error: null,
  };
}

export async function upsertMonthlyRecordCloud(
  supabase: SupabaseClient,
  params: { catId: string; monthKey: string; data: MonthlyJson; updatedBy: string }
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('monthly_records').upsert(
    {
      cat_id: params.catId,
      month_key: params.monthKey,
      data: params.data,
      updated_by: params.updatedBy,
    },
    { onConflict: 'cat_id,month_key' }
  );
  if (error) return { error: new Error(error.message) };
  return { error: null };
}
