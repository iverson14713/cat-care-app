/**
 * Pet Care — iOS/Android scheduled local notifications (Capacitor).
 * Notifications fire from the OS even when the app is closed or killed.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { APP_BRAND_ZH } from '../brand';
import type { Reminder } from '../reminders';
import { safeGetItem, safeSetItem } from '../safeStorage';

export const PETCARE_NOTIFICATION_TITLE = APP_BRAND_ZH;

export type PetCareNotificationPermission = 'unsupported' | 'prompt' | 'granted' | 'denied';

const ID_BASE = 50_000;
const ID_SPAN = 900_000;
export const PETCARE_DEBUG_TEST_NOTIFICATION_ID = 49_999;

const PERM_CACHE_MS = 60_000;
let cachedPermission: { value: PetCareNotificationPermission; at: number } | null = null;
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let syncInFlight: Promise<{ scheduled: number; permission: PetCareNotificationPermission }> | null =
  null;
let listenersBound = false;

export type CareReminderCategory =
  | 'feeding'
  | 'water'
  | 'litter'
  | 'deworming'
  | 'litter_change'
  | 'vet'
  | 'daily_record'
  | 'custom';

export function isPetCareNativeLocalNotificationsAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

export function petCareNotificationNumericId(reminderId: string): number {
  let hash = 0;
  const key = `pc:${reminderId}`;
  for (let i = 0; i < key.length; i++) {
    hash = (Math.imul(31, hash) + key.charCodeAt(i)) | 0;
  }
  return ID_BASE + (Math.abs(hash) % ID_SPAN);
}

export function inferReminderCategory(reminder: Reminder): CareReminderCategory {
  const title = reminder.title.toLowerCase();
  if (reminder.type === 'deworming' || /驅蟲|除蟲|deworm/i.test(reminder.title)) {
    return 'deworming';
  }
  if (reminder.type === 'vet' || /獸醫|vet|回診/i.test(reminder.title)) {
    return 'vet';
  }
  if (reminder.type === 'weight' || /紀錄|體重|daily log/i.test(reminder.title)) {
    return 'daily_record';
  }
  if (/換砂|貓砂/i.test(reminder.title)) {
    return 'litter_change';
  }
  if (/鏟|排泄|清潔|砂盆|litter|potty/i.test(reminder.title)) {
    return 'litter';
  }
  if (/水|water|飲/i.test(reminder.title)) {
    return 'water';
  }
  if (/餵|食|feed|meal/i.test(reminder.title)) {
    return 'feeding';
  }
  return 'custom';
}

export function buildPetCareNotificationCopy(
  catName: string,
  reminder: Reminder,
  lang: 'zh' | 'en'
): { title: string; body: string } {
  const name = catName.trim() || (lang === 'zh' ? '毛孩' : 'your pet');
  const category = inferReminderCategory(reminder);

  if (lang === 'zh') {
    const bodies: Record<CareReminderCategory, string> = {
      feeding: `該餵 ${name} 吃飯囉 🍚`,
      water: '別忘了幫毛孩補水 💧',
      litter: '小提醒：該處理毛孩的定期照護了 🧹',
      deworming: `小提醒：${name} 的除蟲時間到了 💊`,
      litter_change: `該幫 ${name} 換砂囉 ✨`,
      vet: `別忘了 ${name} 的看診 / 回診 🏥`,
      daily_record: '今天也記得記錄一下照護狀況 📝',
      custom: `該看看 ${name} 今天的狀態囉 🐾`,
    };
    return {
      title: reminder.title.trim() || PETCARE_NOTIFICATION_TITLE,
      body: bodies[category],
    };
  }

  const bodiesEn: Record<CareReminderCategory, string> = {
    feeding: `Time to feed ${name} 🍚`,
    water: "Don't forget fresh water 💧",
    litter: 'Gentle nudge: time for routine care 🧹',
    deworming: `Reminder: deworming for ${name} 💊`,
    litter_change: `Time to refresh ${name}'s litter ✨`,
    vet: `Vet / follow-up reminder for ${name} 🏥`,
    daily_record: 'Remember to log care today 📝',
    custom: `Check in on ${name} today 🐾`,
  };
  return {
    title: reminder.title.trim() || PETCARE_NOTIFICATION_TITLE,
    body: bodiesEn[category],
  };
}

function parseTime(time: string): { hour: number; minute: number } {
  const [h, min] = time.split(':').map((x) => Number(x));
  return { hour: h, minute: min };
}

function isOurNotificationId(id: number): boolean {
  return id === PETCARE_DEBUG_TEST_NOTIFICATION_ID || (id >= ID_BASE && id < ID_BASE + ID_SPAN);
}

async function listPetCarePendingIds(): Promise<number[]> {
  try {
    const { notifications } = await LocalNotifications.getPending();
    return (notifications ?? [])
      .map((n) => n.id)
      .filter((id): id is number => typeof id === 'number' && isOurNotificationId(id));
  } catch {
    return [];
  }
}

export function invalidatePetCareNotificationPermissionCache(): void {
  cachedPermission = null;
}

export async function getPetCareNotificationPermission(
  force = false
): Promise<PetCareNotificationPermission> {
  if (!isPetCareNativeLocalNotificationsAvailable()) return 'unsupported';
  if (
    !force &&
    cachedPermission &&
    Date.now() - cachedPermission.at < PERM_CACHE_MS
  ) {
    return cachedPermission.value;
  }
  try {
    const { display } = await LocalNotifications.checkPermissions();
    const value =
      display === 'granted' || display === 'denied' || display === 'prompt' ? display : 'prompt';
    cachedPermission = { value, at: Date.now() };
    return value;
  } catch (e) {
    console.warn('[petcare-notifications] checkPermissions', e);
    return 'unsupported';
  }
}

export async function requestPetCareNotificationPermission(): Promise<PetCareNotificationPermission> {
  if (!isPetCareNativeLocalNotificationsAvailable()) return 'unsupported';
  try {
    const { display } = await LocalNotifications.requestPermissions();
    const value =
      display === 'granted' || display === 'denied' || display === 'prompt' ? display : 'prompt';
    cachedPermission = { value, at: Date.now() };
    safeSetItem('petcare_notification_permission_asked', '1');
    return value;
  } catch (e) {
    console.warn('[petcare-notifications] requestPermissions', e);
    return 'unsupported';
  }
}

export function wasPetCareNotificationPermissionAsked(): boolean {
  return safeGetItem('petcare_notification_permission_asked') === '1';
}

function nextOnceFireAt(reminder: Reminder, from: Date): Date | null {
  if (!reminder.dueDate) return null;
  const { hour, minute } = parseTime(reminder.time);
  const [y, mo, d] = reminder.dueDate.split('-').map(Number);
  const at = new Date(y, mo - 1, d, hour, minute, 0, 0);
  return at.getTime() > from.getTime() + 30_000 ? at : null;
}

function nextIntervalFireAt(reminder: Reminder, from: Date): Date | null {
  const { hour, minute } = parseTime(reminder.time);
  const at = new Date(from);
  at.setHours(hour, minute, 0, 0);
  if (at.getTime() <= from.getTime() + 30_000) {
    if (reminder.repeatType === 'daily') at.setDate(at.getDate() + reminder.repeatInterval);
    else if (reminder.repeatType === 'weekly') at.setDate(at.getDate() + 7 * reminder.repeatInterval);
    else if (reminder.repeatType === 'monthly') at.setMonth(at.getMonth() + reminder.repeatInterval);
  }
  return at;
}

type ScheduleRow = {
  id: number;
  title: string;
  body: string;
  schedule: Record<string, unknown>;
  extra: Record<string, unknown>;
};

function buildScheduleForReminder(
  reminder: Reminder,
  catName: string,
  lang: 'zh' | 'en',
  from: Date
): ScheduleRow | null {
  if (!reminder.enabled) return null;

  const { title, body } = buildPetCareNotificationCopy(catName, reminder, lang);
  const { hour, minute } = parseTime(reminder.time);
  const id = petCareNotificationNumericId(reminder.id);
  const extra = {
    reminderId: reminder.id,
    catId: reminder.catId,
    category: inferReminderCategory(reminder),
    source: 'petcare',
  };

  if (reminder.repeatType === 'once') {
    const at = nextOnceFireAt(reminder, from);
    if (!at) return null;
    return {
      id,
      title,
      body,
      schedule: { at, allowWhileIdle: true },
      extra,
    };
  }

  if (reminder.repeatInterval > 1) {
    const at = nextIntervalFireAt(reminder, from);
    if (!at) return null;
    return {
      id,
      title,
      body,
      schedule: { at, allowWhileIdle: true },
      extra,
    };
  }

  if (reminder.repeatType === 'daily') {
    return {
      id,
      title,
      body,
      schedule: { on: { hour, minute }, every: 'day', allowWhileIdle: true },
      extra,
    };
  }

  if (reminder.repeatType === 'weekly') {
    const probe = new Date(from);
    probe.setHours(hour, minute, 0, 0);
    if (probe.getTime() <= from.getTime()) probe.setDate(probe.getDate() + 1);
    const weekday = probe.getDay() + 1;
    return {
      id,
      title,
      body,
      schedule: { on: { weekday, hour, minute }, every: 'week', allowWhileIdle: true },
      extra,
    };
  }

  if (reminder.repeatType === 'monthly') {
    const day = from.getDate();
    return {
      id,
      title,
      body,
      schedule: { on: { day, hour, minute }, every: 'month', allowWhileIdle: true },
      extra,
    };
  }

  return null;
}

export async function cancelPetCareReminderNotification(reminderId: string): Promise<void> {
  if (!isPetCareNativeLocalNotificationsAvailable()) return;
  const id = petCareNotificationNumericId(reminderId);
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch (e) {
    console.warn('[petcare-notifications] cancel reminder', reminderId, e);
  }
}

export async function cancelAllPetCareScheduledNotifications(): Promise<void> {
  if (!isPetCareNativeLocalNotificationsAvailable()) return;
  const ids = await listPetCarePendingIds();
  if (!ids.length) return;
  try {
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch (e) {
    console.warn('[petcare-notifications] cancel all', e);
  }
}

/** Full resync: cancel our pending notifications, then schedule enabled reminders. */
export async function syncPetCareLocalNotifications(
  reminders: Reminder[],
  catNameById: Record<string, string>,
  lang: 'zh' | 'en' = 'zh'
): Promise<{ scheduled: number; permission: PetCareNotificationPermission }> {
  if (!isPetCareNativeLocalNotificationsAvailable()) {
    return { scheduled: 0, permission: 'unsupported' };
  }

  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const permission = await getPetCareNotificationPermission();
    await cancelAllPetCareScheduledNotifications();

    if (permission !== 'granted') {
      return { scheduled: 0, permission };
    }

    const from = new Date();
    const rows: ScheduleRow[] = [];
    for (const reminder of reminders) {
      const catName = catNameById[reminder.catId] ?? '';
      const row = buildScheduleForReminder(reminder, catName, lang, from);
      if (row) rows.push(row);
    }

    if (!rows.length) return { scheduled: 0, permission };

    try {
      await LocalNotifications.schedule({
        notifications: rows.map((row) => ({
          id: row.id,
          title: row.title,
          body: row.body,
          schedule: row.schedule,
          extra: row.extra,
        })),
      });
      return { scheduled: rows.length, permission };
    } catch (e) {
      console.error('[petcare-notifications] schedule failed', e);
      return { scheduled: 0, permission };
    }
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}

/** Debounced resync — avoids permission / getPending spam on rapid state updates. */
export function debouncedSyncPetCareLocalNotifications(
  reminders: Reminder[],
  catNameById: Record<string, string>,
  lang: 'zh' | 'en' = 'zh',
  delayMs = 500
): void {
  if (!isPetCareNativeLocalNotificationsAvailable()) return;
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    syncDebounceTimer = null;
    void syncPetCareLocalNotifications(reminders, catNameById, lang);
  }, delayMs);
}

export type SchedulePetCareTestResult = {
  ok: boolean;
  permission: PetCareNotificationPermission;
  message: string;
};

/** Schedule a test notification ~1 minute from now (close the app to verify). */
export async function schedulePetCareTestNotificationInOneMinute(
  lang: 'zh' | 'en' = 'zh'
): Promise<SchedulePetCareTestResult> {
  if (!isPetCareNativeLocalNotificationsAvailable()) {
    return { ok: false, permission: 'unsupported', message: '此裝置不支援本機推播' };
  }

  const permission = await requestPetCareNotificationPermission();
  if (permission !== 'granted') {
    return {
      ok: false,
      permission,
      message:
        permission === 'denied'
          ? lang === 'zh'
            ? '請至「設定 → 寵物日記」開啟通知'
            : 'Enable notifications in Settings → Pet Care'
          : lang === 'zh'
            ? '請允許通知權限後再試'
            : 'Allow notification permission first',
    };
  }

  const at = new Date(Date.now() + 60_000);
  const body =
    lang === 'zh'
      ? '驗證成功 🐾 就算 App 關閉，照護提醒也會準時出現'
      : 'Test OK 🐾 Local reminders work even when the app is closed';

  try {
    await LocalNotifications.cancel({
      notifications: [{ id: PETCARE_DEBUG_TEST_NOTIFICATION_ID }],
    });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: PETCARE_DEBUG_TEST_NOTIFICATION_ID,
          title: PETCARE_NOTIFICATION_TITLE,
          body,
          schedule: { at, allowWhileIdle: true },
          extra: { source: 'petcare-test-1min' },
        },
      ],
    });
    return {
      ok: true,
      permission,
      message:
        lang === 'zh'
          ? '已排程，約 1 分鐘後會收到通知（可先關閉或滑掉 App）'
          : 'Scheduled — test notification in ~1 minute (you can close the app)',
    };
  } catch (e) {
    console.error('[petcare-notifications] 1min test failed', e);
    return {
      ok: false,
      permission,
      message: lang === 'zh' ? '排程失敗，請稍後再試' : 'Schedule failed — try again',
    };
  }
}

export function initPetCareNotificationBridge(): void {
  if (!isPetCareNativeLocalNotificationsAvailable() || listenersBound) return;
  listenersBound = true;
  void LocalNotifications.addListener('localNotificationActionPerformed', () => {
    window.focus?.();
  });
}
