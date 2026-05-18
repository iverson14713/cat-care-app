import type { SupabaseClient } from '@supabase/supabase-js';
import type { SharedCareMember } from './sharedCareTypes';
import { generateInviteCode } from './sharedCareTypes';

export type CatAccessRole = 'owner' | 'member' | null;

export async function fetchMyRoleForCat(
  supabase: SupabaseClient,
  catId: string,
  userId: string
): Promise<{ role: CatAccessRole; error: Error | null }> {
  const { data: catRow, error: catErr } = await supabase
    .from('cats')
    .select('owner_id')
    .eq('id', catId)
    .maybeSingle();
  if (catErr) return { role: null, error: new Error(catErr.message) };
  if (catRow?.owner_id === userId) return { role: 'owner', error: null };

  const { data, error } = await supabase
    .from('cat_members')
    .select('role')
    .eq('cat_id', catId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { role: null, error: new Error(error.message) };
  const r = data?.role;
  if (r === 'owner' || r === 'member') return { role: r, error: null };
  return { role: null, error: null };
}

export async function fetchCatMembersWithProfiles(
  supabase: SupabaseClient,
  catId: string
): Promise<{ data: SharedCareMember[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('cat_members')
    .select('user_id, role')
    .eq('cat_id', catId)
    .order('created_at', { ascending: true });

  if (error) return { data: [], error: new Error(error.message) };
  const rows = (data ?? []) as { user_id: string; role: string }[];
  const userIds = rows.map((r) => r.user_id);

  const profileMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', userIds);
    if (pErr) return { data: [], error: new Error(pErr.message) };
    for (const p of profiles ?? []) {
      const row = p as { id: string; display_name: string | null };
      const name = row.display_name?.trim();
      profileMap.set(row.id, name || 'Member');
    }
  }

  return {
    data: rows.map((r) => ({
      userId: r.user_id,
      role: r.role === 'owner' ? 'owner' : 'member',
      displayName: profileMap.get(r.user_id) || 'Member',
    })),
    error: null,
  };
}

export async function fetchActiveInviteCodeForCat(
  supabase: SupabaseClient,
  catId: string
): Promise<{ code: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('cat_invite_codes')
    .select('code, revoked_at, expires_at, max_uses, use_count, created_at')
    .eq('cat_id', catId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return { code: null, error: new Error(error.message) };
  const now = Date.now();
  for (const row of data ?? []) {
    const r = row as {
      code: string;
      expires_at: string | null;
      max_uses: number | null;
      use_count: number;
    };
    if (r.expires_at && new Date(r.expires_at).getTime() < now) continue;
    if (r.max_uses != null && r.use_count >= r.max_uses) continue;
    return { code: r.code, error: null };
  }
  return { code: null, error: null };
}

/** Owner: revoke previous active codes and create a new one (valid 30 days). */
export async function createInviteCodeForCat(
  supabase: SupabaseClient,
  catId: string,
  userId: string
): Promise<{ code: string | null; error: Error | null }> {
  const now = new Date().toISOString();
  await supabase
    .from('cat_invite_codes')
    .update({ revoked_at: now })
    .eq('cat_id', catId)
    .is('revoked_at', null);

  let code = generateInviteCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);
    const { error } = await supabase.from('cat_invite_codes').insert({
      cat_id: catId,
      code,
      created_by: userId,
      expires_at: expires.toISOString(),
      max_uses: 20,
    });
    if (!error) return { code, error: null };
    if (error.code === '23505') {
      code = generateInviteCode();
      continue;
    }
    return { code: null, error: new Error(error.message) };
  }
  return { code: null, error: new Error('could not create invite code') };
}

export async function acceptCatInvite(
  supabase: SupabaseClient,
  code: string
): Promise<{ catId: string | null; error: Error | null }> {
  const { data, error } = await supabase.rpc('accept_cat_invite', { p_code: code.trim() });
  if (error) return { catId: null, error: new Error(error.message) };
  if (typeof data === 'string' && data) return { catId: data, error: null };
  return { catId: null, error: new Error('invalid_or_expired_invite') };
}

export async function removeCatMember(
  supabase: SupabaseClient,
  catId: string,
  memberUserId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('cat_members')
    .delete()
    .eq('cat_id', catId)
    .eq('user_id', memberUserId)
    .eq('role', 'member');
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Map cloud cat id → role for current user (owner wins over member). */
export async function fetchMyCatRolesMap(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: Record<string, CatAccessRole>; error: Error | null }> {
  const map: Record<string, CatAccessRole> = {};
  const { data: owned, error: ownErr } = await supabase.from('cats').select('id').eq('owner_id', userId);
  if (ownErr) return { data: {}, error: new Error(ownErr.message) };
  for (const c of owned ?? []) {
    map[(c as { id: string }).id] = 'owner';
  }
  const { data: memberships, error: memErr } = await supabase
    .from('cat_members')
    .select('cat_id, role')
    .eq('user_id', userId);
  if (memErr) return { data: {}, error: new Error(memErr.message) };
  for (const m of memberships ?? []) {
    const row = m as { cat_id: string; role: string };
    if (row.role === 'owner') map[row.cat_id] = 'owner';
    else if (!map[row.cat_id]) map[row.cat_id] = 'member';
  }
  return { data: map, error: null };
}
