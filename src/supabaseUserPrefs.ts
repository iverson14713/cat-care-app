import type { SupabaseClient } from '@supabase/supabase-js';

export type AiPlan = 'free' | 'pro';

export async function fetchUserAiPlan(
  supabase: SupabaseClient,
  userId: string
): Promise<{ plan: AiPlan | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('ai_plan')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { plan: null, error: new Error(error.message) };
  const p = data?.ai_plan;
  if (p === 'pro' || p === 'free') return { plan: p, error: null };
  return { plan: null, error: null };
}

export async function upsertUserAiPlan(
  supabase: SupabaseClient,
  userId: string,
  plan: AiPlan
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('user_preferences').upsert(
    { user_id: userId, ai_plan: plan, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export function mergeAiPlan(cloud: AiPlan | null, local: AiPlan): AiPlan {
  if (cloud === 'pro' || local === 'pro') return 'pro';
  return 'free';
}
