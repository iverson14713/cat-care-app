import type { Session } from '@supabase/supabase-js';
import { getAiPlan, getOrCreateClientId } from './aiClient';
import { buildAssistantHealthFromLocal, type AssistantHealthPayload } from './openaiAssistant';
import type { AppPlan } from './planLimits';
import { getSubscriptionStatus } from './subscription';
import {
  CATS_STORAGE_KEY,
  loadRawCatsFromStorage,
  mergeAndNormalizeCats,
  normalizeAllCats,
  normalizeAndPersistCats,
  normalizeCat,
  type NormalizedCat,
} from './catNormalize';
import { migrateOfflineCatsToCloud, pullCloudDataIntoLocal, pushLocalDataToCloud } from './cloudDataSync';
import { loadReminders, saveReminders, type Reminder } from './reminders';
import { safeGetItem, safeSetItem } from './safeStorage';
import { fetchCatsForUser, isCloudCatId, type AppCat } from './supabaseCats';
import { fetchMyCatRolesMap, type CatAccessRole } from './supabaseSharedCare';
import { getSupabaseClient } from './supabaseClient';

const SELECTED_CAT_KEY = 'cat-calendar-selected-cat-id';
const DEFAULT_CAT_ID = 'default-cat';

/** Minimum splash visibility (brand moment). */
export const SPLASH_MIN_MS = 800;
/** Hard cap — never block the user longer than this on splash. */
export const SPLASH_MAX_MS = 2000;

export type BootstrapStatus = 'ready' | 'partial' | 'error';

export type AppBootstrapResult = {
  session: Session | null;
  cats: NormalizedCat[];
  selectedCatId: string;
  reminders: Reminder[];
  aiClientId: string;
  appPlan: AppPlan;
  assistantQuota: AssistantHealthPayload;
  catRolesMap: Record<string, CatAccessRole>;
  cloudSyncDone: boolean;
  bootstrapStatus: BootstrapStatus;
  /** Set when bootstrapStatus is `error` (i18n key or short message). */
  bootstrapError?: string;
};

export type RunAppBootstrapOptions = {
  /** When false, only local/session essentials — no cloud pull/push (fast). */
  cloudSync?: boolean;
};

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pickSelectedCatId(cats: NormalizedCat[]): string {
  const active = cats.filter((c) => !c.isArchived);
  const saved = safeGetItem(SELECTED_CAT_KEY);
  if (saved && active.some((c) => c.id === saved)) return saved;
  return active[0]?.id ?? cats[0]?.id ?? DEFAULT_CAT_ID;
}

function buildLocalCore(uid: string) {
  const aiClientId = getOrCreateClientId();
  const usageDate = todayKey();
  const reminders = loadReminders();
  const appPlan = getSubscriptionStatus();
  const cats = normalizeAndPersistCats(uid);
  const selectedCatId = pickSelectedCatId(cats);
  const assistantQuota = buildAssistantHealthFromLocal(appPlan, aiClientId, usageDate);
  saveReminders(reminders);
  safeSetItem(SELECTED_CAT_KEY, selectedCatId);
  return { reminders, appPlan, cats, selectedCatId, aiClientId, assistantQuota, usageDate };
}

/** Fast path: session + local storage only (no cloud network). */
export async function runAppBootstrap(
  options: RunAppBootstrapOptions = {}
): Promise<AppBootstrapResult> {
  const cloudSync = options.cloudSync !== false;
  const sb = getSupabaseClient();
  let session: Session | null = null;

  if (sb) {
    const { data } = await sb.auth.getSession();
    session = data.session ?? null;
  }

  const uid = session?.user?.id ?? '';
  const core = buildLocalCore(uid);
  let { reminders, appPlan, cats, selectedCatId, aiClientId, assistantQuota, usageDate } = core;
  let catRolesMap: Record<string, CatAccessRole> = {};
  let cloudSyncDone = false;

  if (cloudSync && sb && session?.user) {
    let localCats = normalizeAllCats(loadRawCatsFromStorage(), uid);
    const offline = localCats.filter((c) => !isCloudCatId(c.id));
    if (offline.length > 0) {
      const mig = await migrateOfflineCatsToCloud(sb, uid, localCats as unknown as AppCat[]);
      if (mig.errors.length > 0) console.warn('[bootstrap offline cat migrate]', mig.errors.join('; '));
      localCats = normalizeAllCats(
        mig.cats.map((c) => normalizeCat(c, uid)).filter(Boolean) as NormalizedCat[],
        uid
      );
      safeSetItem(CATS_STORAGE_KEY, JSON.stringify(localCats));
      const remapped = mig.idMap[selectedCatId];
      if (remapped) selectedCatId = remapped;
    }

    const { data: cloudList, error } = await fetchCatsForUser(sb);
    if (!error) {
      const cloudIdSet = new Set(cloudList.map((c) => c.id));
      const localFiltered = localCats.filter((c) => !isCloudCatId(c.id) || cloudIdSet.has(c.id));
      cats = mergeAndNormalizeCats(cloudList, localFiltered, uid);
      safeSetItem(CATS_STORAGE_KEY, JSON.stringify(cats));

      const rolesRes = await fetchMyCatRolesMap(sb, uid);
      catRolesMap = rolesRes.data;

      const active = cats.filter((c) => !c.isArchived);
      selectedCatId = active.some((c) => c.id === selectedCatId)
        ? selectedCatId
        : active[0]?.id ?? cats[0]?.id ?? DEFAULT_CAT_ID;
      safeSetItem(SELECTED_CAT_KEY, selectedCatId);

      const cloudIds = cats.filter((c) => isCloudCatId(c.id) && cloudIdSet.has(c.id)).map((c) => c.id);
      if (cloudIds.length > 0) {
        await pullCloudDataIntoLocal(sb, uid, cloudIds, usageDate);
        const pushErrs = await pushLocalDataToCloud(sb, uid, cloudIds, reminders, usageDate);
        if (pushErrs.length > 0) console.warn('[bootstrap cloud push]', pushErrs.join('; '));
      }

      reminders = loadReminders();
      appPlan = getAiPlan();
      cloudSyncDone = true;
    }
  }

  return {
    session,
    cats,
    selectedCatId,
    reminders,
    aiClientId,
    appPlan,
    assistantQuota,
    catRolesMap,
    cloudSyncDone,
    bootstrapStatus: cloudSyncDone ? 'ready' : 'partial',
  };
}

function createMinimalBootstrap(bootstrapError = 'init_failed'): AppBootstrapResult {
  const core = buildLocalCore('');
  return {
    session: null,
    cats: core.cats,
    selectedCatId: core.selectedCatId,
    reminders: core.reminders,
    aiClientId: core.aiClientId,
    appPlan: core.appPlan,
    assistantQuota: core.assistantQuota,
    catRolesMap: {},
    cloudSyncDone: false,
    bootstrapStatus: 'error',
    bootstrapError,
  };
}

/**
 * Splash budget: wait up to SPLASH_MAX_MS for full bootstrap, then continue with local data.
 */
export async function runSplashBootstrap(): Promise<AppBootstrapResult> {
  try {
    const raced = await Promise.race([
      runAppBootstrap({ cloudSync: true }).then((r) => ({ ok: true as const, r })),
      delay(SPLASH_MAX_MS).then(() => ({ ok: false as const })),
    ]);

    if (raced.ok) {
      return { ...raced.r, bootstrapStatus: 'ready', cloudSyncDone: true };
    }

    const local = await runAppBootstrap({ cloudSync: false });
    return { ...local, bootstrapStatus: 'partial', cloudSyncDone: false };
  } catch (err) {
    console.error('[bootstrap]', err);
    try {
      const local = await runAppBootstrap({ cloudSync: false });
      return {
        ...local,
        bootstrapStatus: 'error',
        bootstrapError: 'init_failed',
        cloudSyncDone: false,
      };
    } catch (inner) {
      console.error('[bootstrap] local fallback failed', inner);
      return createMinimalBootstrap('init_failed');
    }
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
