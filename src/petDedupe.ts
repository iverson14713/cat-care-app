import type { SupabaseClient } from '@supabase/supabase-js';
import { isDefaultPetDisplayName, logDefaultPetDecision } from './defaultPet';
import { rewriteCatStorageKeys } from './cloudDataSync';
import { isCloudCatId, type AppCat } from './supabaseCats';
import { permanentlyDeleteCatForOwner } from './supabaseCatPermanentDelete';

export type DedupeDefaultPetsResult = {
  duplicateIdsFound: string[];
  removedIds: string[];
  mergedIds: string[];
  keptId: string | null;
  errors: string[];
};

function parseCreatedAt(cat: AppCat): number {
  const t = cat.createdAt ? new Date(cat.createdAt).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

async function catHasCloudCareData(supabase: SupabaseClient, catId: string): Promise<boolean> {
  const tables = ['daily_records', 'weight_records', 'monthly_records', 'weekly_reports'] as const;
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('cat_id').eq('cat_id', catId).limit(1);
    if (error) continue;
    if ((data?.length ?? 0) > 0) return true;
  }
  const { data: photos } = await supabase
    .from('daily_record_photos')
    .select('cat_id')
    .eq('cat_id', catId)
    .limit(1);
  return (photos?.length ?? 0) > 0;
}

async function mergeCloudCatIdReferences(
  supabase: SupabaseClient,
  fromId: string,
  toId: string
): Promise<string | null> {
  const tables = [
    'daily_records',
    'daily_record_photos',
    'weight_records',
    'monthly_records',
    'weekly_reports',
    'care_events',
    'cat_members',
  ] as const;
  for (const table of tables) {
    const { error } = await supabase.from(table).update({ cat_id: toId }).eq('cat_id', fromId);
    if (error) return `${table}: ${error.message}`;
  }
  return null;
}

/**
 * Remove duplicate cloud pets named like the default placeholder ("我的寵物" / "My pet").
 * Keeps the oldest (or preferred selected) pet; merges care data when present.
 */
export async function dedupeDuplicateDefaultPetsOnCloud(
  supabase: SupabaseClient,
  userId: string,
  cloudCats: AppCat[],
  preferredCatId?: string
): Promise<DedupeDefaultPetsResult> {
  const defaults = cloudCats.filter((c) => isCloudCatId(c.id) && isDefaultPetDisplayName(c.name));
  const result: DedupeDefaultPetsResult = {
    duplicateIdsFound: defaults.map((c) => c.id),
    removedIds: [],
    mergedIds: [],
    keptId: null,
    errors: [],
  };

  if (defaults.length <= 1) {
    result.keptId = defaults[0]?.id ?? null;
    if (defaults.length > 0) {
      logDefaultPetDecision({
        userId,
        cloudCount: cloudCats.length,
        localCount: 0,
        action: 'dedupe',
        detail: 'no duplicate default-named cloud pets',
      });
    }
    return result;
  }

  const sorted = [...defaults].sort((a, b) => parseCreatedAt(a) - parseCreatedAt(b));
  const preferred =
    preferredCatId && sorted.some((c) => c.id === preferredCatId)
      ? sorted.find((c) => c.id === preferredCatId)!
      : sorted[0]!;
  result.keptId = preferred.id;

  console.warn('[pets] duplicate default-named cloud pets detected', {
    userId: userId.slice(0, 8),
    count: defaults.length,
    ids: defaults.map((c) => c.id),
    keeping: preferred.id,
  });

  for (const dup of sorted) {
    if (dup.id === preferred.id) continue;
    const hasData = await catHasCloudCareData(supabase, dup.id);
    if (hasData) {
      rewriteCatStorageKeys(dup.id, preferred.id);
      const mergeErr = await mergeCloudCatIdReferences(supabase, dup.id, preferred.id);
      if (mergeErr) {
        result.errors.push(`merge ${dup.id}→${preferred.id}: ${mergeErr}`);
        console.warn('[pets] could not merge duplicate default pet data', {
          from: dup.id,
          to: preferred.id,
          mergeErr,
        });
        continue;
      }
      result.mergedIds.push(dup.id);
    }
    const { error } = await permanentlyDeleteCatForOwner(supabase, dup.id, dup.profilePhoto);
    if (error) {
      result.errors.push(`delete ${dup.id}: ${error.message}`);
      continue;
    }
    result.removedIds.push(dup.id);
  }

  logDefaultPetDecision({
    userId,
    cloudCount: cloudCats.length,
    localCount: 0,
    action: 'dedupe',
    detail: `removed=${result.removedIds.length} merged=${result.mergedIds.length} kept=${preferred.id}`,
  });

  return result;
}
