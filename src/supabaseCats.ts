import type { SupabaseClient } from '@supabase/supabase-js';
import { defaultEmojiForPetType, normalizePetType, type PetType } from './petTypes';

export type CatRow = {
  id: string;
  owner_id: string;
  pet_type?: string;
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
  is_archived?: boolean;
  created_at: string;
  updated_at: string;
};

export type AppCat = {
  id: string;
  name: string;
  petType: PetType;
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
  isArchived?: boolean;
  ownerId?: string;
  createdAt?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CAT_SELECT_BASE =
  'id, owner_id, name, emoji, profile_photo, birthday, gender, breed, neutered, chip_no, chronic_note, allergy_note, vet_clinic, profile_note, created_at, updated_at';

const CAT_SELECT = `${CAT_SELECT_BASE}, is_archived, pet_type`;

/** Shown when DB migration 20260519120000_cats_is_archived.sql has not been applied yet. */
export const CATS_ARCHIVE_MIGRATION_HINT =
  '雲端資料庫需要更新才能使用封存功能。請聯絡管理員完成伺服器更新後，重新整理 App。';

function isArchivedColumnError(message: string): boolean {
  return /is_archived/i.test(message) && /(does not exist|schema cache|column)/i.test(message);
}

function isPetTypeColumnError(message: string): boolean {
  return /pet_type/i.test(message) && /(does not exist|schema cache|column)/i.test(message);
}

function isOptionalCatsColumnError(message: string): boolean {
  return isArchivedColumnError(message) || isPetTypeColumnError(message);
}

function archiveMigrationError(): Error {
  return new Error(CATS_ARCHIVE_MIGRATION_HINT);
}

export function isCloudCatId(id: string): boolean {
  return UUID_RE.test(id);
}

export function rowToAppCat(row: CatRow): AppCat {
  const petType = normalizePetType(row.pet_type);
  return {
    id: row.id,
    name: row.name,
    petType,
    emoji: row.emoji || defaultEmojiForPetType(petType),
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
    isArchived: Boolean(row.is_archived),
    ownerId: row.owner_id ?? '',
    createdAt: row.created_at ?? '',
  };
}

/** Cloud list first (by created_at), then local-only cats not present in cloud. */
export function mergeCloudCatsWithLocal(cloud: AppCat[], local: AppCat[]): AppCat[] {
  const byId = new Map<string, AppCat>();
  for (const c of cloud) byId.set(c.id, c);
  for (const c of local) {
    if (!byId.has(c.id)) byId.set(c.id, c);
    else {
      const cloudCat = byId.get(c.id)!;
      byId.set(c.id, {
        ...cloudCat,
        isArchived: cloudCat.isArchived ?? c.isArchived,
        petType: cloudCat.petType ?? c.petType,
      });
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const aArch = a.isArchived ? 1 : 0;
    const bArch = b.isArchived ? 1 : 0;
    if (aArch !== bArch) return aArch - bArch;
    return a.name.localeCompare(b.name);
  });
}

export async function fetchCatsForUser(
  supabase: SupabaseClient
): Promise<{ data: AppCat[]; error: Error | null }> {
  let { data, error } = await supabase.from('cats').select(CAT_SELECT).order('created_at', { ascending: true });

  if (error && isOptionalCatsColumnError(error.message)) {
    const legacy = await supabase.from('cats').select(CAT_SELECT_BASE).order('created_at', { ascending: true });
    data = legacy.data;
    error = legacy.error;
  }

  if (error) return { data: [], error: new Error(error.message) };
  const rows = (data ?? []) as CatRow[];
  return {
    data: rows.map((r) =>
      rowToAppCat({ ...r, is_archived: r.is_archived ?? false, pet_type: r.pet_type ?? 'cat' })
    ),
    error: null,
  };
}

export async function insertCatForOwner(
  supabase: SupabaseClient,
  ownerId: string,
  cat: AppCat
): Promise<{ data: AppCat | null; error: Error | null }> {
  const id = isCloudCatId(cat.id) ? cat.id : crypto.randomUUID();
  const petType = normalizePetType(cat.petType);
  const base = {
    id,
    owner_id: ownerId,
    name: cat.name,
    emoji: cat.emoji || defaultEmojiForPetType(petType),
    pet_type: petType,
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

  let { data, error } = await supabase
    .from('cats')
    .insert({ ...base, is_archived: false })
    .select(CAT_SELECT)
    .single();

  if (error && isPetTypeColumnError(error.message)) {
    const { pet_type: _pt, ...withoutPetType } = base;
    const retry = await supabase
      .from('cats')
      .insert({ ...withoutPetType, is_archived: false })
      .select(`${CAT_SELECT_BASE}, is_archived`)
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error && isArchivedColumnError(error.message)) {
    const { pet_type: _pt, ...withoutPetType } = base;
    const legacy = await supabase.from('cats').insert(withoutPetType).select(CAT_SELECT_BASE).single();
    data = legacy.data;
    error = legacy.error;
  }

  if (error) return { data: null, error: new Error(error.message) };
  return {
    data: rowToAppCat({ ...(data as CatRow), is_archived: false, pet_type: petType }),
    error: null,
  };
}

export async function updateCatForOwner(
  supabase: SupabaseClient,
  cat: AppCat
): Promise<{ error: Error | null }> {
  if (!isCloudCatId(cat.id)) return { error: null };
  const petType = normalizePetType(cat.petType);
  const payload = {
    name: cat.name,
    emoji: cat.emoji || defaultEmojiForPetType(petType),
    pet_type: petType,
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
  let { error } = await supabase.from('cats').update(payload).eq('id', cat.id);
  if (error && isPetTypeColumnError(error.message)) {
    const { pet_type: _pt, ...withoutPetType } = payload;
    const retry = await supabase.from('cats').update(withoutPetType).eq('id', cat.id);
    error = retry.error;
  }
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Archive cat (soft hide); does not delete related records. */
export async function archiveCatForOwner(
  supabase: SupabaseClient,
  catId: string
): Promise<{ error: Error | null }> {
  if (!isCloudCatId(catId)) return { error: null };
  const { error } = await supabase.from('cats').update({ is_archived: true }).eq('id', catId);
  if (error) {
    if (isArchivedColumnError(error.message)) return { error: archiveMigrationError() };
    return { error: new Error(error.message) };
  }
  return { error: null };
}

/** Restore archived cat to main list. */
export async function restoreCatForOwner(
  supabase: SupabaseClient,
  catId: string
): Promise<{ error: Error | null }> {
  if (!isCloudCatId(catId)) return { error: null };
  const { error } = await supabase.from('cats').update({ is_archived: false }).eq('id', catId);
  if (error) {
    if (isArchivedColumnError(error.message)) return { error: archiveMigrationError() };
    return { error: new Error(error.message) };
  }
  return { error: null };
}

/** @deprecated Use archiveCatForOwner — kept for compatibility. */
export async function deleteCatForOwner(
  supabase: SupabaseClient,
  catId: string
): Promise<{ error: Error | null }> {
  return archiveCatForOwner(supabase, catId);
}
