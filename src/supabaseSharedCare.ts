import type { SupabaseClient } from '@supabase/supabase-js';
import type { SharedCareCatState } from './sharedCareMock';

export async function fetchSharedCareForCat(
  supabase: SupabaseClient,
  catId: string
): Promise<{ data: SharedCareCatState | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('shared_care_states')
    .select('state')
    .eq('cat_id', catId)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  const raw = data?.state;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { data: raw as SharedCareCatState, error: null };
  }
  return { data: null, error: null };
}

export async function upsertSharedCareForCat(
  supabase: SupabaseClient,
  catId: string,
  state: SharedCareCatState
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('shared_care_states').upsert(
    { cat_id: catId, state, updated_at: new Date().toISOString() },
    { onConflict: 'cat_id' }
  );
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export function mergeSharedCareState(
  cloud: SharedCareCatState | null,
  local: SharedCareCatState
): SharedCareCatState {
  if (!cloud) return local;
  const members = cloud.members?.length ? cloud.members : local.members;
  const activities = [...(cloud.activities ?? []), ...(local.activities ?? [])].slice(0, 40);
  return {
    members,
    inviteCode: cloud.inviteCode ?? local.inviteCode,
    activities,
  };
}
