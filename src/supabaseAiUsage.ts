import type { SupabaseClient } from '@supabase/supabase-js';
import { mapSupabaseErr, type DbError } from './supabaseError';

export type UserAiUsageRow = {
  usage_date: string;
  daily_used: number;
  vet_used: number;
};

export async function fetchUserAiUsage(
  supabase: SupabaseClient,
  userId: string,
  usageDate: string
): Promise<{ data: UserAiUsageRow | null; error: DbError | null }> {
  const { data, error } = await supabase
    .from('user_ai_usage')
    .select('usage_date, daily_used, vet_used')
    .eq('user_id', userId)
    .eq('usage_date', usageDate)
    .maybeSingle();

  if (error) return { data: null, error: mapSupabaseErr(error) };
  if (!data) return { data: null, error: null };
  return {
    data: {
      usage_date: data.usage_date as string,
      daily_used: Math.max(0, Math.floor(Number(data.daily_used) || 0)),
      vet_used: Math.max(0, Math.floor(Number(data.vet_used) || 0)),
    },
    error: null,
  };
}

export async function upsertUserAiUsage(
  supabase: SupabaseClient,
  userId: string,
  usageDate: string,
  dailyUsed: number,
  vetUsed: number
): Promise<{ error: DbError | null }> {
  const { error } = await supabase.from('user_ai_usage').upsert(
    {
      user_id: userId,
      usage_date: usageDate,
      daily_used: Math.max(0, Math.floor(dailyUsed)),
      vet_used: Math.max(0, Math.floor(vetUsed)),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,usage_date' }
  );
  if (error) return { error: mapSupabaseErr(error) };
  return { error: null };
}

/** Cross-device: take the higher count so usage is never lost. */
export function mergeUsageCounts(
  cloudDaily: number,
  localDaily: number,
  cloudVet: number,
  localVet: number
): { dailyUsed: number; vetUsed: number } {
  return {
    dailyUsed: Math.max(cloudDaily, localDaily),
    vetUsed: Math.max(cloudVet, localVet),
  };
}
