import type { AppCat } from './supabaseCats';
import { isCloudCatId } from './supabaseCats';
import { defaultEmojiForPetType } from './petTypes';

/** Local-only placeholder id (never a stable cloud id). */
export const DEFAULT_PLACEHOLDER_PET_ID = 'default-cat';

export const DEFAULT_PET_NAME_ZH = '我的寵物';
export const DEFAULT_PET_NAME_EN = 'My pet';

const DEFAULT_PET_NAMES = new Set([DEFAULT_PET_NAME_ZH, DEFAULT_PET_NAME_EN]);

export function isDefaultPetDisplayName(name: string): boolean {
  return DEFAULT_PET_NAMES.has(name.trim());
}

export function isLocalPlaceholderPetId(id: string): boolean {
  const t = id.trim();
  return t === DEFAULT_PLACEHOLDER_PET_ID || t.startsWith('local-');
}

type PetLike = { id: string; name: string; petType?: string; emoji?: string };

/** True when this row is the auto-seeded offline placeholder (not user-created "我的寵物" on cloud). */
export function isOfflineAutoPlaceholderPet(cat: PetLike): boolean {
  if (isCloudCatId(cat.id)) return false;
  return isLocalPlaceholderPetId(cat.id) || isDefaultPetDisplayName(cat.name);
}

/** Drop local placeholder rows when the user already has real pets (cloud or custom-named). */
export function stripOfflinePlaceholdersWhenUserHasPets<T extends PetLike>(cats: T[]): T[] {
  const hasRealPet = cats.some((c) => isCloudCatId(c.id) || !isDefaultPetDisplayName(c.name));
  if (!hasRealPet) return cats;
  const filtered = cats.filter((c) => !isOfflineAutoPlaceholderPet(c));
  if (filtered.length > 0) return filtered;
  return cats;
}

export function buildDefaultAppCat(ownerId: string): AppCat {
  return {
    id: DEFAULT_PLACEHOLDER_PET_ID,
    name: DEFAULT_PET_NAME_ZH,
    petType: 'cat',
    emoji: defaultEmojiForPetType('cat'),
    profilePhoto: '',
    birthday: '',
    gender: '',
    breed: '',
    neutered: '',
    chipNo: '',
    chronicNote: '',
    allergyNote: '',
    vetClinic: '',
    profileNote: '',
    isArchived: false,
    ownerId,
    createdAt: new Date().toISOString(),
  };
}

export type DefaultPetLogContext = {
  userId: string;
  cloudCount: number;
  localCount: number;
  action: 'create' | 'skip_has_pets' | 'skip_placeholder_migrate' | 'dedupe';
  detail?: string;
};

export function logDefaultPetDecision(ctx: DefaultPetLogContext): void {
  console.log('[pets] default pet', {
    action: ctx.action,
    userId: ctx.userId.slice(0, 8),
    cloudCount: ctx.cloudCount,
    localCount: ctx.localCount,
    detail: ctx.detail,
  });
}
