import type { SupabaseClient } from '@supabase/supabase-js';
import type { Reminder } from './reminders';

export async function fetchUserReminders(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: Reminder[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('user_reminders')
    .select('reminders')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { data: [], error: new Error(error.message) };
  const raw = data?.reminders;
  if (!Array.isArray(raw)) return { data: [], error: null };
  return { data: raw as Reminder[], error: null };
}

export async function upsertUserReminders(
  supabase: SupabaseClient,
  userId: string,
  reminders: Reminder[]
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('user_reminders').upsert(
    {
      user_id: userId,
      reminders,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Merge by reminder id: cloud wins when same id exists. */
export function mergeReminders(cloud: Reminder[], local: Reminder[]): Reminder[] {
  const map = new Map<string, Reminder>();
  for (const r of local) map.set(r.id, r);
  for (const r of cloud) map.set(r.id, r);
  return Array.from(map.values());
}
