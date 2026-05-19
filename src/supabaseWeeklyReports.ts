import type { SupabaseClient } from '@supabase/supabase-js';
import type { AssistantWeeklyReportJson } from './aiCareAssistant';
import { normalizeWeeklyReport } from './weeklyReportModel';
import type { SavedWeeklyReport } from './weeklyReportStorage';

export async function fetchWeeklyReportsForCat(
  supabase: SupabaseClient,
  catId: string,
  limit = 52
): Promise<{ data: SavedWeeklyReport[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('weekly_reports')
    .select('cat_id, week_end, report, saved_at')
    .eq('cat_id', catId)
    .order('week_end', { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: new Error(error.message) };
  const rows = (data ?? []) as {
    cat_id: string;
    week_end: string;
    report: unknown;
    saved_at: string;
  }[];
  return {
    data: rows.map((r) => ({
      catId: r.cat_id,
      weekEnd: r.week_end,
      savedAt: r.saved_at,
      report: normalizeWeeklyReport(r.report),
    })),
    error: null,
  };
}

export async function upsertWeeklyReportCloud(
  supabase: SupabaseClient,
  params: {
    catId: string;
    weekEnd: string;
    report: AssistantWeeklyReportJson;
    savedAt: string;
    updatedBy: string;
  }
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('weekly_reports').upsert(
    {
      cat_id: params.catId,
      week_end: params.weekEnd,
      report: normalizeWeeklyReport(params.report),
      saved_at: params.savedAt,
      updated_by: params.updatedBy,
    },
    { onConflict: 'cat_id,week_end' }
  );
  if (error) return { error: new Error(error.message) };
  return { error: null };
}
