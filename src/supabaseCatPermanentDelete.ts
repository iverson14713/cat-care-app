import type { SupabaseClient } from '@supabase/supabase-js';
import { isCloudCatId } from './supabaseCats';
import { fetchAllDailyPhotosForCat } from './supabasePhotos';

function parseSupabaseStorageObject(url: string): { bucket: string; path: string } | null {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

async function removeStorageUrl(supabase: SupabaseClient, url: string): Promise<void> {
  const parsed = parseSupabaseStorageObject(url);
  if (!parsed) return;
  const { error } = await supabase.storage.from(parsed.bucket).remove([parsed.path]);
  if (error) console.warn('[storage remove]', parsed.bucket, parsed.path, error.message);
}

/** Best-effort: remove profile + daily photo URLs that point at Supabase Storage (base64 skipped). */
async function removeCatStorageAssets(
  supabase: SupabaseClient,
  catId: string,
  profilePhoto?: string
): Promise<void> {
  if (profilePhoto && !profilePhoto.startsWith('data:')) {
    await removeStorageUrl(supabase, profilePhoto);
  }
  const { data: photoRows } = await fetchAllDailyPhotosForCat(supabase, catId);
  for (const row of photoRows) {
    for (const url of [...row.abnormal_photos, ...row.daily_photos]) {
      if (url && !url.startsWith('data:')) await removeStorageUrl(supabase, url);
    }
  }
}

/**
 * Hard-delete cat row; FK ON DELETE CASCADE removes daily/monthly/weight/photos/weekly/care_events/members.
 * Caller should purge localStorage and filter user reminders.
 */
export async function permanentlyDeleteCatForOwner(
  supabase: SupabaseClient,
  catId: string,
  profilePhoto?: string
): Promise<{ error: Error | null }> {
  if (!isCloudCatId(catId)) return { error: null };

  await removeCatStorageAssets(supabase, catId, profilePhoto);

  const { error } = await supabase.from('cats').delete().eq('id', catId);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}
