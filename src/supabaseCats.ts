import type { SupabaseClient } from '@supabase/supabase-js';

export type CatRow = {
  id: string;
  owner_id: string;
  name: string;
  emoji: string;
  profile_photo: string;
  birthday: string;
  gender: string;
  breed: string;
  neutered: string;
  chip_no: string;
  chronic_note: string;
  allergy_note: string;
  vet_clinic: string;
  profile_note: string;
  created_at: string;
  updated_at: string;
};

export type AppCat = {
  id: string;
  name: string;
  emoji: string;
  profilePhoto?: string;
  birthday?: string;
  gender?: string;
  breed?: string;
  neutered?: string;
  chipNo?: string;
  chronicNote?: string;
  allergyNote?: string;
  vetClinic?: string;
  profileNote?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCloudCatId(id: string): boolean {
  return UUID_RE.test(id);
}

export function rowToAppCat(row: CatRow): AppCat {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    profilePhoto: row.profile_photo ?? '',
    birthday: row.birthday ?? '',
    gender: row.gender ?? '',
    breed: row.breed ?? '',
    neutered: row.neutered ?? '',
    chipNo: row.chip_no ?? '',
    chronicNote: row.chronic_note ?? '',
    allergyNote: row.allergy_note ?? '',
    vetClinic: row.vet_clinic ?? '',
    profileNote: row.profile_note ?? '',
  };
}

/** Cloud list first (by created_at), then local-only cats not present in cloud. */
export function mergeCloudCatsWithLocal(cloud: AppCat[], local: AppCat[]): AppCat[] {
  const ids = new Set(cloud.map((c) => c.id));
  const localsOnly = local.filter((c) => !ids.has(c.id));
  return [...cloud, ...localsOnly];
}

export async function fetchCatsForUser(supabase: SupabaseClient): Promise<{ data: AppCat[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('cats')
    .select(
      'id, owner_id, name, emoji, profile_photo, birthday, gender, breed, neutered, chip_no, chronic_note, allergy_note, vet_clinic, profile_note, created_at, updated_at'
    )
    .order('created_at', { ascending: true });

  if (error) return { data: [], error: new Error(error.message) };
  const rows = (data ?? []) as CatRow[];
  return { data: rows.map(rowToAppCat), error: null };
}

export async function insertCatForOwner(
  supabase: SupabaseClient,
  ownerId: string,
  cat: AppCat
): Promise<{ data: AppCat | null; error: Error | null }> {
  const id = isCloudCatId(cat.id) ? cat.id : crypto.randomUUID();
  const payload = {
    id,
    owner_id: ownerId,
    name: cat.name,
    emoji: cat.emoji || '🐱',
    profile_photo: cat.profilePhoto ?? '',
    birthday: cat.birthday ?? '',
    gender: cat.gender ?? '',
    breed: cat.breed ?? '',
    neutered: cat.neutered ?? '',
    chip_no: cat.chipNo ?? '',
    chronic_note: cat.chronicNote ?? '',
    allergy_note: cat.allergyNote ?? '',
    vet_clinic: cat.vetClinic ?? '',
    profile_note: cat.profileNote ?? '',
  };

  const { data, error } = await supabase.from('cats').insert(payload).select().single();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: rowToAppCat(data as CatRow), error: null };
}

export async function updateCatForOwner(
  supabase: SupabaseClient,
  cat: AppCat
): Promise<{ error: Error | null }> {
  if (!isCloudCatId(cat.id)) return { error: null };
  const payload = {
    name: cat.name,
    emoji: cat.emoji || '🐱',
    profile_photo: cat.profilePhoto ?? '',
    birthday: cat.birthday ?? '',
    gender: cat.gender ?? '',
    breed: cat.breed ?? '',
    neutered: cat.neutered ?? '',
    chip_no: cat.chipNo ?? '',
    chronic_note: cat.chronicNote ?? '',
    allergy_note: cat.allergyNote ?? '',
    vet_clinic: cat.vetClinic ?? '',
    profile_note: cat.profileNote ?? '',
  };
  const { error } = await supabase.from('cats').update(payload).eq('id', cat.id);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function deleteCatForOwner(
  supabase: SupabaseClient,
  catId: string
): Promise<{ error: Error | null }> {
  if (!isCloudCatId(catId)) return { error: null };
  const { error } = await supabase.from('cats').delete().eq('id', catId);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}
