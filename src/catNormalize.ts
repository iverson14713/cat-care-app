import { defaultEmojiForPetType, normalizePetType, type PetType } from './petTypes';
import type { AppCat } from './supabaseCats';
import { isCloudCatId } from './supabaseCats';
import { safeSetItem } from './safeStorage';

export const CATS_STORAGE_KEY = 'cat-calendar-cats';

export type NormalizedCat = {
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
  isArchived: boolean;
  createdAt: string;
  ownerId: string;
};

const DEFAULT_CATS: NormalizedCat[] = [
  {
    id: 'default-cat',
    name: '我的寵物',
    petType: 'cat',
    emoji: '🐱',
    isArchived: false,
    createdAt: new Date().toISOString(),
    ownerId: '',
  },
];

function newLocalId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

/** Map raw localStorage / merged object → canonical pet row. */
export function normalizeCat(raw: unknown, fallbackOwnerId = ''): NormalizedCat | null {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const idRaw = typeof c.id === 'string' ? c.id.trim() : '';
  const id = idRaw || newLocalId();
  const name = typeof c.name === 'string' && c.name.trim() ? c.name.trim() : '我的寵物';
  const petType = normalizePetType(c.petType ?? c.pet_type);
  const isArchived = Boolean(c.isArchived ?? c.is_archived);
  const createdAt =
    (typeof c.createdAt === 'string' && c.createdAt) ||
    (typeof c.created_at === 'string' && c.created_at) ||
    new Date().toISOString();
  const ownerId =
    (typeof c.ownerId === 'string' && c.ownerId) ||
    (typeof c.owner_id === 'string' && c.owner_id) ||
    fallbackOwnerId ||
    '';

  return {
    id,
    name,
    petType,
    emoji:
      typeof c.emoji === 'string' && c.emoji
        ? c.emoji
        : defaultEmojiForPetType(petType),
    profilePhoto: typeof c.profilePhoto === 'string' ? c.profilePhoto : '',
    birthday: typeof c.birthday === 'string' ? c.birthday : '',
    gender: typeof c.gender === 'string' ? c.gender : '',
    breed: typeof c.breed === 'string' ? c.breed : '',
    neutered: typeof c.neutered === 'string' ? c.neutered : '',
    chipNo: typeof c.chipNo === 'string' ? c.chipNo : '',
    chronicNote: typeof c.chronicNote === 'string' ? c.chronicNote : '',
    allergyNote: typeof c.allergyNote === 'string' ? c.allergyNote : '',
    vetClinic: typeof c.vetClinic === 'string' ? c.vetClinic : '',
    profileNote: typeof c.profileNote === 'string' ? c.profileNote : '',
    isArchived,
    createdAt,
    ownerId,
  };
}

export function normalizeAllCats(rawList: unknown[], fallbackOwnerId = ''): NormalizedCat[] {
  const seen = new Set<string>();
  const out: NormalizedCat[] = [];
  for (const raw of rawList) {
    const cat = normalizeCat(raw, fallbackOwnerId);
    if (!cat || seen.has(cat.id)) continue;
    seen.add(cat.id);
    out.push(cat);
  }
  if (out.length === 0) {
    return DEFAULT_CATS.map((d) => normalizeCat(d, fallbackOwnerId)!);
  }
  return out.sort((a, b) => {
    if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
    return a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name);
  });
}

export function appCatToNormalized(app: AppCat, fallbackOwnerId = ''): NormalizedCat {
  return normalizeCat(app, fallbackOwnerId) ?? DEFAULT_CATS[0];
}

export function mergeAndNormalizeCats(
  cloud: AppCat[],
  local: NormalizedCat[],
  fallbackOwnerId = ''
): NormalizedCat[] {
  const byId = new Map<string, NormalizedCat>();
  for (const app of cloud) {
    const n = appCatToNormalized(app, fallbackOwnerId);
    byId.set(n.id, n);
  }
  for (const loc of local) {
    if (!byId.has(loc.id)) {
      byId.set(loc.id, loc);
    } else {
      const cloudN = byId.get(loc.id)!;
      byId.set(loc.id, {
        ...cloudN,
        isArchived: cloudN.isArchived || loc.isArchived,
        petType: cloudN.petType || loc.petType,
        profilePhoto: cloudN.profilePhoto || loc.profilePhoto,
        ownerId: cloudN.ownerId || loc.ownerId,
      });
    }
  }
  return normalizeAllCats(Array.from(byId.values()), fallbackOwnerId);
}

export function loadRawCatsFromStorage(): unknown[] {
  try {
    const raw = localStorage.getItem(CATS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function normalizeAndPersistCats(fallbackOwnerId = ''): NormalizedCat[] {
  const normalized = normalizeAllCats(loadRawCatsFromStorage(), fallbackOwnerId);
  safeSetItem(CATS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function isValidPetForArchive(cat: NormalizedCat): boolean {
  return Boolean(cat.id && cat.name.trim());
}

export type ArchiveErrorLang = 'zh' | 'en';

/** User-facing archive failure copy (no raw API / column names). */
export function formatArchiveErrorMessage(err: unknown, lang: ArchiveErrorLang): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const low = msg.toLowerCase();
  if (/is_archived|schema cache|does not exist|migration/i.test(msg)) {
    return lang === 'zh'
      ? '雲端資料庫尚未更新封存功能，請稍後再試或聯絡管理員。'
      : 'Cloud database needs an update for archiving. Please try again later.';
  }
  if (/permission|denied|forbidden|42501|not allowed/i.test(low)) {
    return lang === 'zh'
      ? '你沒有封存這隻寵物的權限（可能為共同照護成員）。'
      : 'You do not have permission to archive this pet (shared care member).';
  }
  if (/network|fetch|timeout|failed to fetch/i.test(low)) {
    return lang === 'zh' ? '網路連線不穩，請稍後再試。' : 'Network issue — please try again.';
  }
  if (msg.trim().length > 0 && msg.length < 120 && !/^[a-z_]+$/i.test(msg.trim())) {
    return msg;
  }
  return lang === 'zh' ? '封存失敗，請稍後再試。' : 'Could not archive. Please try again.';
}

export function formatRestoreErrorMessage(err: unknown, lang: ArchiveErrorLang): string {
  const base = formatArchiveErrorMessage(err, lang);
  if (lang === 'zh') {
    return base.replace('封存', '恢復').replace('歸檔', '恢復');
  }
  return base.replace(/archive/gi, 'restore');
}

export { isCloudCatId };
