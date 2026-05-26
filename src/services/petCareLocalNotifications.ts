/**
 * Pet Care — iOS/Android local notifications (Capacitor).
 * Care reminders only; no remote push / APNs / FCM.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { APP_BRAND_ZH } from '../brand';
import { isPetCareDevMode } from '../lib/petCareDevMode';
import type { Reminder } from '../reminders';
import { buildReminderNotificationCopy } from './notifications';

export const PETCARE_NOTIFICATION_TITLE = APP_BRAND_ZH;

export type PetCareNotificationPermission = 'unsupported' | 'prompt' | 'granted' | 'denied';

const ID_BASE = 50_000;
const ID_SPAN = 900_000;
export const PETCARE_DEBUG_TEST_NOTIFICATION_ID = 49_999;

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

export async function getPetCareNotificationPermission(): Promise<PetCareNotificationPermission> {
  if (!isPetCareNativeLocalNotificationsAvailable()) return 'unsupported';
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display === 'granted' || display === 'denied' || display === 'prompt') return display;
    return 'prompt';
  } catch (e) {
    console.warn('[petcare-notifications] checkPermissions', e);
    return 'unsupported';
  }
}

export async function requestPetCareNotificationPermission(): Promise<PetCareNotificationPermission> {
  if (!isPetCareNativeLocalNotificationsAvailable()) return 'unsupported';
  try {
    const { display } = await LocalNotifications.requestPermissions();
    if (display === 'granted' || display === 'denied' || display === 'prompt') return display;
    return 'prompt';
  } catch (e) {
    console.warn('[petcare-notifications] requestPermissions', e);
    return 'unsupported';
  }
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

  const { title, body } = buildReminderNotificationCopy(catName, reminder, lang);
  const { hour, minute } = parseTime(reminder.time);
  const id = petCareNotificationNumericId(reminder.id);
  const extra = { reminderId: reminder.id, catId: reminder.catId, source: 'petcare' };

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

export async function cancelAllPetCareScheduledNotifications(): Promise<void> {
  if (!isPetCareNativeLocalNotificationsAvailable()) return;
  const ids = await listPetCarePendingIds();
  if (!ids.length) return;
  try {
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch (e) {
    console.warn('[petcare-notifications] cancel', e);
  }
}

export async function syncPetCareLocalNotifications(
  reminders: Reminder[],
  catNameById: Record<string, string>,
  lang: 'zh' | 'en' = 'zh'
): Promise<{ scheduled: number; permission: PetCareNotificationPermission }> {
  if (!isPetCareNativeLocalNotificationsAvailable()) {
    return { scheduled: 0, permission: 'unsupported' };
  }

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
}

export type SchedulePetCareDebugTestResult = {
  ok: boolean;
  permission: PetCareNotificationPermission;
  message: string;
};

export async function schedulePetCareDebugTestNotification(
  lang: 'zh' | 'en' = 'zh'
): Promise<SchedulePetCareDebugTestResult> {
  if (!isPetCareDevMode()) {
    return { ok: false, permission: 'unsupported', message: '僅開發模式可用' };
  }
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
            ? '請至系統設定允許「寵物日記」通知'
            : 'Allow notifications for Pet Care in Settings'
          : lang === 'zh'
            ? '請允許通知權限後再試'
            : 'Allow notification permission first',
    };
  }

  const at = new Date(Date.now() + 10_000);
  const body =
    lang === 'zh'
      ? '如果你看到這則通知，代表 iOS 本機照護提醒正常 🐾'
      : 'If you see this, local care reminders work on this device 🐾';

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
          extra: { source: 'petcare-debug-test' },
        },
      ],
    });
    return {
      ok: true,
      permission,
      message: lang === 'zh' ? '已排程，約 10 秒後會收到測試通知' : 'Scheduled — test in ~10 seconds',
    };
  } catch (e) {
    console.error('[petcare-notifications] debug test failed', e);
    return {
      ok: false,
      permission,
      message: lang === 'zh' ? '排程失敗，請稍後再試' : 'Schedule failed — try again',
    };
  }
}

let listenersBound = false;

export function initPetCareNotificationBridge(): void {
  if (!isPetCareNativeLocalNotificationsAvailable() || listenersBound) return;
  listenersBound = true;
  void LocalNotifications.addListener('localNotificationActionPerformed', () => {
    window.focus?.();
  });
}
