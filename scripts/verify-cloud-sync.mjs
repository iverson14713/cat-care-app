/**
 * Live check: Supabase tables + RLS for cloud sync (matches frontend modules).
 *
 * Setup in project root `.env`:
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJ...
 *   SUPABASE_TEST_EMAIL=your@email.com
 *   SUPABASE_TEST_PASSWORD=your-password
 *
 * Usage: npm run verify:cloud-sync
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });

const url = process.env.VITE_SUPABASE_URL?.trim();
const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
const email = process.env.SUPABASE_TEST_EMAIL?.trim();
const password = process.env.SUPABASE_TEST_PASSWORD?.trim();

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

if (!url || !anonKey) {
  fail('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
}
if (!email || !password) {
  fail('Missing SUPABASE_TEST_EMAIL or SUPABASE_TEST_PASSWORD in .env (needed for RLS tests)');
}

const supabase = createClient(url, anonKey);
const today = new Date().toISOString().slice(0, 10);
const monthKey = today.slice(0, 7);

const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ name, ok: false, msg });
    console.log(`✗ ${name}: ${msg}`);
  }
}

const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
if (authErr) fail(`Sign-in failed: ${authErr.message}`);
const userId = authData.user?.id;
if (!userId) fail('No user id after sign-in');

console.log(`Signed in as ${email} (${userId})\n`);

let catId = null;
await check('cats — select owned cat', async () => {
  const { data, error } = await supabase.from('cats').select('id').eq('owner_id', userId).limit(1);
  if (error) throw new Error(error.message);
  if (data?.[0]?.id) {
    catId = data[0].id;
    return;
  }
  const { data: inserted, error: insErr } = await supabase
    .from('cats')
    .insert({ owner_id: userId, name: 'Sync Test Cat', emoji: '🐱' })
    .select('id')
    .single();
  if (insErr) throw new Error(insErr.message);
  catId = inserted.id;
});

if (!catId) fail('Could not resolve a cloud cat id');

await check('weight_records — upsert + select', async () => {
  const weightId = crypto.randomUUID();
  const { error: upErr } = await supabase.from('weight_records').upsert(
    {
      id: weightId,
      cat_id: catId,
      record_date: today,
      weight_kg: 4.5,
      note: 'verify-cloud-sync',
      updated_by: userId,
    },
    { onConflict: 'id' }
  );
  if (upErr) throw new Error(upErr.message);
  const { error: upErr2 } = await supabase.from('weight_records').upsert(
    {
      id: weightId,
      cat_id: catId,
      record_date: today,
      weight_kg: 4.6,
      note: 'verify-cloud-sync-retry',
      updated_by: userId,
    },
    { onConflict: 'id' }
  );
  if (upErr2) throw new Error(`retry upsert: ${upErr2.message}`);
  const { data, error } = await supabase
    .from('weight_records')
    .select('weight_kg, note')
    .eq('cat_id', catId)
    .eq('record_date', today)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || Number(data.weight_kg) !== 4.5) throw new Error('read back mismatch');
});

await check('monthly_records — upsert + select', async () => {
  const payload = { groomed: true, _verify: true };
  const { error: upErr } = await supabase.from('monthly_records').upsert(
    {
      cat_id: catId,
      month_key: monthKey,
      data: payload,
      updated_by: userId,
    },
    { onConflict: 'cat_id,month_key' }
  );
  if (upErr) throw new Error(upErr.message);
  const { data, error } = await supabase
    .from('monthly_records')
    .select('data')
    .eq('cat_id', catId)
    .eq('month_key', monthKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.data?._verify) throw new Error('read back mismatch');
});

await check('user_reminders — upsert + select', async () => {
  const reminders = [{ id: 'verify-reminder-1', title: 'Test', time: '09:00', enabled: true }];
  const { error: upErr } = await supabase.from('user_reminders').upsert(
    { user_id: userId, reminders, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  if (upErr) throw new Error(upErr.message);
  const { data, error } = await supabase.from('user_reminders').select('reminders').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!Array.isArray(data?.reminders) || data.reminders.length === 0) throw new Error('read back mismatch');
});

await check('daily_record_photos — upsert + select', async () => {
  const abnormal_photos = ['data:image/png;base64,verify-abnormal'];
  const daily_photos = ['data:image/png;base64,verify-daily'];
  const { error: upErr } = await supabase.from('daily_record_photos').upsert(
    {
      cat_id: catId,
      record_date: today,
      abnormal_photos,
      daily_photos,
      updated_by: userId,
    },
    { onConflict: 'cat_id,record_date' }
  );
  if (upErr) throw new Error(upErr.message);
  const { data, error } = await supabase
    .from('daily_record_photos')
    .select('abnormal_photos, daily_photos')
    .eq('cat_id', catId)
    .eq('record_date', today)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!Array.isArray(data?.abnormal_photos) || data.abnormal_photos.length !== 1) {
    throw new Error('read back mismatch');
  }
});

await check('weekly_reports — upsert + select', async () => {
  const report = { weekSummary: { zh: 'verify', en: 'verify' } };
  const saved_at = new Date().toISOString();
  const { error: upErr } = await supabase.from('weekly_reports').upsert(
    {
      cat_id: catId,
      week_end: today,
      report,
      saved_at,
      updated_by: userId,
    },
    { onConflict: 'cat_id,week_end' }
  );
  if (upErr) throw new Error(upErr.message);
  const { data, error } = await supabase
    .from('weekly_reports')
    .select('report')
    .eq('cat_id', catId)
    .eq('week_end', today)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.report) throw new Error('read back mismatch');
});

await check('user_ai_usage — upsert + select', async () => {
  const { error: upErr } = await supabase.from('user_ai_usage').upsert(
    {
      user_id: userId,
      usage_date: today,
      daily_used: 2,
      vet_used: 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,usage_date' }
  );
  if (upErr) throw new Error(upErr.message);
  const { data, error } = await supabase
    .from('user_ai_usage')
    .select('daily_used, vet_used')
    .eq('user_id', userId)
    .eq('usage_date', today)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.daily_used !== 2 || data?.vet_used !== 1) throw new Error('read back mismatch');
});

await check('shared_care_states — upsert + select', async () => {
  const state = {
    members: [{ id: 'local-owner', name: 'Tester', role: 'owner' }],
    inviteCode: 'VERIFY1',
    activities: [],
  };
  const { error: upErr } = await supabase.from('shared_care_states').upsert(
    { cat_id: catId, state, updated_at: new Date().toISOString() },
    { onConflict: 'cat_id' }
  );
  if (upErr) throw new Error(upErr.message);
  const { data, error } = await supabase
    .from('shared_care_states')
    .select('state')
    .eq('cat_id', catId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.state?.inviteCode !== 'VERIFY1') throw new Error('read back mismatch');
});

await check('user_preferences — upsert + select', async () => {
  const { error: upErr } = await supabase.from('user_preferences').upsert(
    { user_id: userId, ai_plan: 'pro', updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  if (upErr) throw new Error(upErr.message);
  const { data, error } = await supabase
    .from('user_preferences')
    .select('ai_plan')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.ai_plan !== 'pro') throw new Error('read back mismatch');
});

const failed = results.filter((r) => !r.ok);
console.log('\n---');
if (failed.length === 0) {
  console.log(`All ${results.length} table checks passed. Frontend modules use the same table/column names.`);
  process.exit(0);
} else {
  console.log(`${failed.length} failed, ${results.length - failed.length} passed.`);
  process.exit(1);
}
