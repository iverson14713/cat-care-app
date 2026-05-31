import { createClient } from '@supabase/supabase-js';

function getEnv(name) {
  const v = process.env[name];
  return typeof v === 'string' ? v.trim() : '';
}

function bearerTokenFromAuthHeader(authorization) {
  const raw = typeof authorization === 'string' ? authorization.trim() : '';
  if (!raw) return '';
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return (m?.[1] || '').trim();
}

function assertConfigured() {
  const url = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url) {
    return { ok: false, status: 503, error: 'Missing SUPABASE_URL (or VITE_SUPABASE_URL)', code: 'NO_SUPABASE_URL' };
  }
  if (!serviceRoleKey) {
    return { ok: false, status: 503, error: 'Missing SUPABASE_SERVICE_ROLE_KEY', code: 'NO_SERVICE_ROLE_KEY' };
  }
  return { ok: true, url, serviceRoleKey };
}

async function safeDeleteByCatIds(supabaseAdmin, table, catIds) {
  if (!Array.isArray(catIds) || catIds.length === 0) return;
  // best-effort; ignore errors so the auth delete still proceeds
  try {
    await supabaseAdmin.from(table).delete().in('cat_id', catIds);
  } catch (e) {
    console.warn('[account delete] cleanup failed', table, e instanceof Error ? e.message : String(e));
  }
}

async function safeDeleteByUserId(supabaseAdmin, table, userField, userId) {
  try {
    await supabaseAdmin.from(table).delete().eq(userField, userId);
  } catch (e) {
    console.warn('[account delete] cleanup failed', table, e instanceof Error ? e.message : String(e));
  }
}

async function deleteIfExistsByUserId(supabaseAdmin, table, userField, userId, errors) {
  const { error } = await supabaseAdmin.from(table).delete().eq(userField, userId);
  if (!error) return;
  // Ignore missing table in case schema differs across envs.
  if (error.code === '42P01') return;
  errors.push({ table, message: error.message, code: error.code || null });
}

async function deleteIfExistsByCatIds(supabaseAdmin, table, catIds, errors) {
  if (!Array.isArray(catIds) || catIds.length === 0) return;
  const { error } = await supabaseAdmin.from(table).delete().in('cat_id', catIds);
  if (!error) return;
  if (error.code === '42P01') return;
  errors.push({ table, message: error.message, code: error.code || null });
}

/**
 * Delete the currently authenticated user and related data.
 * Requires Authorization: Bearer <access_token>.
 */
export async function deleteAccountPOST({ authorization }) {
  const cfg = assertConfigured();
  if (!cfg.ok) return { status: cfg.status, json: { error: cfg.error, code: cfg.code } };

  const token = bearerTokenFromAuthHeader(authorization);
  if (!token) return { status: 401, json: { error: 'Missing Authorization bearer token', code: 'UNAUTHENTICATED' } };

  const supabaseAdmin = createClient(cfg.url, cfg.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  const userId = userData?.user?.id;
  if (userErr || !userId) {
    return {
      status: 401,
      json: { error: userErr?.message || 'Invalid session', code: 'UNAUTHENTICATED' },
    };
  }

  console.log('[account delete] start', { userId });

  const errors = [];

  // 1) Remove user from any shared-care memberships (cats owned by others).
  await deleteIfExistsByUserId(supabaseAdmin, 'cat_members', 'user_id', userId, errors);

  // 2) Delete owned cats (FK ON DELETE CASCADE removes daily/monthly/weight/photos/weekly/care_events/members).
  let ownedCatIds = [];
  try {
    const { data: owned, error: ownErr } = await supabaseAdmin.from('cats').select('id').eq('owner_id', userId);
    if (!ownErr && Array.isArray(owned)) {
      ownedCatIds = owned.map((r) => r?.id).filter((x) => typeof x === 'string' && x.length > 0);
    }
  } catch (e) {
    console.warn('[account delete] could not list owned cats', e instanceof Error ? e.message : String(e));
  }

  // Best-effort cleanup for tables that may not cascade in older schemas.
  await deleteIfExistsByCatIds(supabaseAdmin, 'cat_invite_codes', ownedCatIds, errors);
  await deleteIfExistsByCatIds(supabaseAdmin, 'daily_record_photos', ownedCatIds, errors);
  await deleteIfExistsByCatIds(supabaseAdmin, 'weekly_reports', ownedCatIds, errors);
  await deleteIfExistsByCatIds(supabaseAdmin, 'care_events', ownedCatIds, errors);
  await deleteIfExistsByCatIds(supabaseAdmin, 'care_records', ownedCatIds, errors);
  await deleteIfExistsByCatIds(supabaseAdmin, 'daily_records', ownedCatIds, errors);
  await deleteIfExistsByCatIds(supabaseAdmin, 'monthly_records', ownedCatIds, errors);
  await deleteIfExistsByCatIds(supabaseAdmin, 'weight_records', ownedCatIds, errors);

  if (ownedCatIds.length > 0) {
    const { error: catDelErr } = await supabaseAdmin.from('cats').delete().in('id', ownedCatIds);
    if (catDelErr && catDelErr.code !== '42P01') {
      errors.push({ table: 'cats', message: catDelErr.message, code: catDelErr.code || null });
    }
  }

  // 3) Delete user-scoped tables.
  await deleteIfExistsByUserId(supabaseAdmin, 'user_reminders', 'user_id', userId, errors);
  await deleteIfExistsByUserId(supabaseAdmin, 'user_preferences', 'user_id', userId, errors);
  await deleteIfExistsByUserId(supabaseAdmin, 'user_ai_usage', 'user_id', userId, errors);
  await deleteIfExistsByUserId(supabaseAdmin, 'ai_usage', 'user_id', userId, errors);
  await deleteIfExistsByUserId(supabaseAdmin, 'promo_redemptions', 'user_id', userId, errors);
  await deleteIfExistsByUserId(supabaseAdmin, 'profiles', 'id', userId, errors);

  // 3b) Any user-owned cats that might not have been listed due to schema drift.
  await deleteIfExistsByUserId(supabaseAdmin, 'cats', 'owner_id', userId, errors);

  if (errors.length > 0) {
    console.error('[account delete] data cleanup errors', { userId, errors });
    return {
      status: 500,
      json: { error: 'Failed to delete all user data', code: 'DATA_DELETE_FAILED', details: errors },
    };
  }

  // 4) Finally delete auth user.
  const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (delErr) {
    console.error('[account delete] auth delete failed', delErr.message);
    return { status: 500, json: { error: delErr.message, code: 'DELETE_FAILED' } };
  }

  console.log('[account delete] done', { userId });
  return { status: 200, json: { ok: true } };
}

