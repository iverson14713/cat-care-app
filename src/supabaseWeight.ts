import type { SupabaseClient } from '@supabase/supabase-js';

export type WeightRow = {
  id: string;
  cat_id: string;
  record_date: string;
  weight_kg: number;
  note: string;
  updated_at: string;
};

export type AppWeightRecord = {
  id: string;
  date: string;
  weight: number;
  note: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function rowToApp(row: WeightRow): AppWeightRecord {
  return {
    id: row.id,
    date: row.record_date,
    weight: Number(row.weight_kg),
    note: row.note ?? '',
  };
}

export async function fetchWeightRecordsForCat(
  supabase: SupabaseClient,
  catId: string
): Promise<{ data: AppWeightRecord[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('weight_records')
    .select('id, cat_id, record_date, weight_kg, note, updated_at')
    .eq('cat_id', catId)
    .order('record_date', { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };
  const rows = (data ?? []) as WeightRow[];
  return {
    data: rows
      .filter((r) => r.record_date && Number.isFinite(Number(r.weight_kg)) && Number(r.weight_kg) > 0)
      .map(rowToApp),
    error: null,
  };
}

export async function upsertWeightRecordsForCat(
  supabase: SupabaseClient,
  catId: string,
  records: AppWeightRecord[],
  updatedBy: string
): Promise<{ error: Error | null }> {
  if (records.length === 0) return { error: null };
  const payload = records
    .filter((r) => r.date && Number.isFinite(r.weight) && r.weight > 0)
    .map((r) => {
      const row: {
        id?: string;
        cat_id: string;
        record_date: string;
        weight_kg: number;
        note: string;
        updated_by: string;
      } = {
        cat_id: catId,
        record_date: r.date,
        weight_kg: r.weight,
        note: r.note ?? '',
        updated_by: updatedBy,
      };
      // Local ids are often `cat-...` from makeId(); omit id so DB default applies.
      if (UUID_RE.test(r.id)) row.id = r.id;
      return row;
    });

  const { error } = await supabase.from('weight_records').upsert(payload, {
    onConflict: 'cat_id,record_date',
  });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Merge cloud weights into local list: union by date, cloud wins on same date. */
export function mergeWeightRecords(cloud: AppWeightRecord[], local: AppWeightRecord[]): AppWeightRecord[] {
  const byDate = new Map<string, AppWeightRecord>();
  for (const r of local) {
    if (r.date) byDate.set(r.date, r);
  }
  for (const r of cloud) {
    if (r.date) byDate.set(r.date, r);
  }
  return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
}
