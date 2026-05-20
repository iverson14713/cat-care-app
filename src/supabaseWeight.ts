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

/** Stable cloud id for offline `makeId()` rows — same local id always maps to the same UUID on retry. */
function stableLocalWeightUuid(catId: string, localId: string): string {
  const input = `weight:${catId}:${localId}`;
  const bytes = new Uint8Array(16);
  for (let i = 0; i < input.length; i++) {
    bytes[i % 16] ^= input.charCodeAt(i);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function rowToApp(row: WeightRow): AppWeightRecord {
  return {
    id: row.id,
    date: row.record_date,
    weight: Number(row.weight_kg),
    note: row.note ?? '',
  };
}

function isValidWeightRecord(r: AppWeightRecord): boolean {
  return Boolean(r.date && Number.isFinite(r.weight) && r.weight > 0);
}

/** Ensure every row has a cloud UUID (offline makeId ids use a stable derived UUID). */
function resolveWeightId(catId: string, record: AppWeightRecord): string {
  return UUID_RE.test(record.id) ? record.id : stableLocalWeightUuid(catId, record.id);
}

/**
 * Normalize for upsert: valid rows only, stable UUID per row, one row per calendar date (last wins).
 */
function prepareWeightUpsertPayload(
  catId: string,
  records: AppWeightRecord[],
  updatedBy: string
): { payload: WeightRow[]; appRecords: AppWeightRecord[] } {
  const byDate = new Map<string, AppWeightRecord>();

  for (const r of records) {
    if (!isValidWeightRecord(r)) continue;
    const id = resolveWeightId(catId, r);
    byDate.set(r.date, {
      id,
      date: r.date,
      weight: Math.round(r.weight * 100) / 100,
      note: r.note ?? '',
    });
  }

  const appRecords = Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
  const payload = appRecords.map((r) => ({
    id: r.id,
    cat_id: catId,
    record_date: r.date,
    weight_kg: r.weight,
    note: r.note,
    updated_by: updatedBy,
  }));

  return { payload, appRecords };
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

/**
 * Upsert weight rows by primary key `id` — safe for retries (no duplicate pkey on re-sync).
 */
export async function upsertWeightRecordsForCat(
  supabase: SupabaseClient,
  catId: string,
  records: AppWeightRecord[],
  updatedBy: string
): Promise<{ records: AppWeightRecord[]; error: Error | null }> {
  const { payload, appRecords } = prepareWeightUpsertPayload(catId, records, updatedBy);
  if (payload.length === 0) return { records: [], error: null };

  const { error } = await supabase.from('weight_records').upsert(payload, {
    onConflict: 'id',
  });
  if (error) return { records: appRecords, error: new Error(error.message) };
  return { records: appRecords, error: null };
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
