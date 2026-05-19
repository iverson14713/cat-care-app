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

export const SPLASH_MIN_MS = 1500;
export const SPLASH_TARGET_MS = 1750;

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
};

export async function runAppBootstrap(): Promise<AppBootstrapResult> {
  const sb = getSupabaseClient();
  let session: Session | null = null;

  if (sb) {
    const { data } = await sb.auth.getSession();
    session = data.session ?? null;
  }

  const uid = session?.user?.id ?? '';
  const aiClientId = getOrCreateClientId();
  const usageDate = todayKey();

  let reminders = loadReminders();
  let appPlan = getSubscriptionStatus();
  let cats = normalizeAndPersistCats(uid);
  let selectedCatId = pickSelectedCatId(cats);
  let catRolesMap: Record<string, CatAccessRole> = {};
  let cloudSyncDone = false;

  if (sb && session?.user) {
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
  } else {
    safeSetItem(SELECTED_CAT_KEY, selectedCatId);
  }

  saveReminders(reminders);

  const assistantQuota = buildAssistantHealthFromLocal(appPlan, aiClientId, usageDate);

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
  };
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
