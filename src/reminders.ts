import { getAiPlan } from './aiClient';
import { safeGetItem, safeLoadJson, safeSetItem, storageError } from './safeStorage';

export const REMINDER_LIMIT_FREE = 3;
/** Effectively unlimited for Pro (test flow; no real billing yet). */
export const REMINDER_LIMIT_PRO = 100_000;

const STORAGE_KEY = 'cat-calendar-reminders';
const PERMISSION_ASKED_KEY = 'cat-calendar-notification-asked';

export type ReminderRepeatType = 'daily' | 'weekly' | 'monthly';

/** Category for templates / notification copy. */
export type ReminderKind = 'daily' | 'weight' | 'deworming' | 'vet' | 'custom';

export type Reminder = {
  id: string;
  catId: string;
  type: ReminderKind;
  title: string;
  enabled: boolean;
  /** Local time HH:mm (24h). */
  time: string;
  repeatType: ReminderRepeatType;
  repeatInterval: number;
  lastTriggeredAt: string | null;
};

export type ReminderTemplate = {
  kind: ReminderKind;
  titleZh: string;
  titleEn: string;
  time: string;
  repeatType: ReminderRepeatType;
  repeatInterval: number;
};

export const REMINDER_TEMPLATES: ReminderTemplate[] = [
  { kind: 'daily', titleZh: '早上餵食', titleEn: 'Morning feeding', time: '08:00', repeatType: 'daily', repeatInterval: 1 },
  { kind: 'daily', titleZh: '晚上餵食', titleEn: 'Evening feeding', time: '19:00', repeatType: 'daily', repeatInterval: 1 },
  { kind: 'daily', titleZh: '清理排泄區', titleEn: 'Clean potty area', time: '21:00', repeatType: 'daily', repeatInterval: 1 },
  { kind: 'daily', titleZh: '喝水確認', titleEn: 'Water check', time: '12:00', repeatType: 'daily', repeatInterval: 1 },
  { kind: 'weight', titleZh: '量體重', titleEn: 'Weigh in', time: '10:00', repeatType: 'weekly', repeatInterval: 1 },
  { kind: 'deworming', titleZh: '驅蟲', titleEn: 'Deworming', time: '10:00', repeatType: 'monthly', repeatInterval: 1 },
  { kind: 'vet', titleZh: '看獸醫 / 回診', titleEn: 'Vet visit', time: '09:00', repeatType: 'monthly', repeatInterval: 1 },
];

export function remindersWithoutCat(reminders: Reminder[], catId: string): Reminder[] {
  return reminders.filter((r) => r.catId !== catId);
}

export function getReminderLimit(plan?: 'free' | 'pro'): number {
  const p = plan ?? getAiPlan();
  return p === 'pro' ? REMINDER_LIMIT_PRO : REMINDER_LIMIT_FREE;
}

export function loadReminders(): Reminder[] {
  const parsed = safeLoadJson<unknown[]>(STORAGE_KEY, [], 'reminders');
  if (!Array.isArray(parsed)) return [];
  return parsed.map(normalizeReminder).filter(Boolean) as Reminder[];
}

export function saveReminders(list: Reminder[]): void {
  if (!safeSetItem(STORAGE_KEY, JSON.stringify(list))) {
    storageError('saveReminders failed', new Error('write failed'), STORAGE_KEY);
  }
}

function normalizeReminder(item: unknown): Reminder | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : '';
  const catId = typeof o.catId === 'string' ? o.catId : '';
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  if (!id || !catId || !title) return null;
  const type = isReminderKind(o.type) ? o.type : 'custom';
  const time = normalizeTime(typeof o.time === 'string' ? o.time : '09:00');
  const repeatType = o.repeatType === 'weekly' || o.repeatType === 'monthly' ? o.repeatType : 'daily';
  const repeatInterval = Math.max(1, Math.floor(Number(o.repeatInterval) || 1));
  return {
    id,
    catId,
    type,
    title,
    enabled: o.enabled !== false,
    time,
    repeatType,
    repeatInterval,
    lastTriggeredAt: typeof o.lastTriggeredAt === 'string' ? o.lastTriggeredAt : null,
  };
}

function isReminderKind(v: unknown): v is ReminderKind {
  return v === 'daily' || v === 'weight' || v === 'deworming' || v === 'vet' || v === 'custom';
}

export function normalizeTime(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '09:00';
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function makeReminderId(): string {
  return `rem-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function createReminderFromTemplate(
  template: ReminderTemplate,
  catId: string,
  lang: 'zh' | 'en'
): Reminder {
  return {
    id: makeReminderId(),
    catId,
    type: template.kind,
    title: lang === 'zh' ? template.titleZh : template.titleEn,
    enabled: true,
    time: template.time,
    repeatType: template.repeatType,
    repeatInterval: template.repeatInterval,
    lastTriggeredAt: null,
  };
}

export function createCustomReminder(catId: string, partial: Partial<Reminder>): Reminder {
  return {
    id: makeReminderId(),
    catId,
    type: partial.type ?? 'custom',
    title: partial.title?.trim() || 'Reminder',
    enabled: partial.enabled !== false,
    time: normalizeTime(partial.time ?? '09:00'),
    repeatType: partial.repeatType ?? 'daily',
    repeatInterval: Math.max(1, partial.repeatInterval ?? 1),
    lastTriggeredAt: null,
  };
}

export type NotificationPermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

/**
 * Safe Notification constructor — never reference bare `Notification` (iOS Safari / PWA throws
 * ReferenceError: Can't find variable: Notification). Always use window.Notification.
 */
function getBrowserNotification(): typeof Notification | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    if ('Notification' in window) {
      const wn = window.Notification;
      if (wn != null && typeof wn === 'function') return wn;
    }
  } catch {
    // ignore
  }
  return undefined;
}

export function getNotificationSupport(): boolean {
  return getBrowserNotification() != null;
}

function readNotificationPermission(): NotificationPermissionState {
  const N = getBrowserNotification();
  if (!N) return 'unsupported';
  try {
    const p = N.permission;
    if (p === 'granted' || p === 'denied' || p === 'default') return p;
    return 'default';
  } catch {
    return 'unsupported';
  }
}

export function getNotificationPermission(): NotificationPermissionState {
  return readNotificationPermission();
}

export function wasNotificationPermissionAsked(): boolean {
  try {
    return localStorage.getItem(PERMISSION_ASKED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markNotificationPermissionAsked(): void {
  try {
    localStorage.setItem(PERMISSION_ASKED_KEY, '1');
  } catch {
    // ignore
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!getNotificationSupport()) return 'unsupported';
  const N = getBrowserNotification();
  if (!N) return 'unsupported';
  markNotificationPermissionAsked();
  try {
    if (typeof N.requestPermission === 'function') {
      const result = await N.requestPermission();
      if (result === 'granted' || result === 'denied' || result === 'default') {
        return result;
      }
    }
    return readNotificationPermission();
  } catch {
    return readNotificationPermission();
  }
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/** True when this minute matches reminder.time and repeat rules allow firing. */
export function shouldTriggerReminder(reminder: Reminder, now: Date = new Date()): boolean {
  if (!reminder.enabled) return false;
  const [h, min] = reminder.time.split(':').map((x) => Number(x));
  if (now.getHours() !== h || now.getMinutes() !== min) return false;

  const today = localDateKey(now);
  const last = reminder.lastTriggeredAt ? new Date(reminder.lastTriggeredAt) : null;
  const lastDay = last && !Number.isNaN(last.getTime()) ? localDateKey(last) : '';

  if (reminder.repeatType === 'daily') {
    return lastDay !== today;
  }
  if (reminder.repeatType === 'weekly') {
    if (!last || Number.isNaN(last.getTime())) return true;
    return daysBetween(last, now) >= 7 * reminder.repeatInterval;
  }
  if (reminder.repeatType === 'monthly') {
    if (!last || Number.isNaN(last.getTime())) return true;
    return daysBetween(last, now) >= 30 * reminder.repeatInterval;
  }
  return lastDay !== today;
}

export function buildNotificationBody(
  catName: string,
  reminder: Reminder,
  lang: 'zh' | 'en'
): { title: string; body: string } {
  const name = catName.trim() || (lang === 'zh' ? '寵物' : 'your pet');
  if (lang === 'zh') {
    switch (reminder.type) {
      case 'daily':
        if (reminder.title.includes('餵') || reminder.title.includes('食'))
          return { title: '照護提醒', body: `${name} 該吃飯囉 🍚` };
        if (reminder.title.includes('砂') || reminder.title.includes('排泄') || reminder.title.includes('清潔'))
          return { title: '照護提醒', body: `${name} 的環境該清理了 🧹` };
        if (reminder.title.includes('水'))
          return { title: '照護提醒', body: `${name} 記得確認喝水 💧` };
        return { title: '照護提醒', body: `${name}：${reminder.title}` };
      case 'weight':
        return { title: '體重提醒', body: `今天記得幫 ${name} 量體重 ⚖️` };
      case 'deworming':
        return { title: '驅蟲提醒', body: `${name} 該驅蟲了 💊` };
      case 'vet':
        return { title: '看診提醒', body: `${name} 的回診 / 看診提醒 🏥` };
      default:
        return { title: reminder.title, body: `${name}：${reminder.title}` };
    }
  }
  switch (reminder.type) {
    case 'daily':
      if (/feed|meal|breakfast|dinner/i.test(reminder.title))
        return { title: 'Care reminder', body: `Time to feed ${name} 🍚` };
      if (/litter|potty|clean/i.test(reminder.title))
        return { title: 'Care reminder', body: `Time to clean ${name}'s area 🧹` };
      if (/water/i.test(reminder.title))
        return { title: 'Care reminder', body: `Check ${name}'s water 💧` };
      return { title: 'Care reminder', body: `${name}: ${reminder.title}` };
    case 'weight':
      return { title: 'Weight reminder', body: `Remember to weigh ${name} today ⚖️` };
    case 'deworming':
      return { title: 'Deworming', body: `Deworming reminder for ${name} 💊` };
    case 'vet':
      return { title: 'Vet visit', body: `Vet / follow-up reminder for ${name} 🏥` };
    default:
      return { title: reminder.title, body: `${name}: ${reminder.title}` };
  }
}

export function showReminderNotification(
  catName: string,
  reminder: Reminder,
  lang: 'zh' | 'en'
): boolean {
  if (readNotificationPermission() !== 'granted') return false;
  const N = getBrowserNotification();
  if (!N) return false;
  const { title, body } = buildNotificationBody(catName, reminder, lang);
  try {
    const n = new N(title, {
      body,
      tag: `cat-reminder-${reminder.id}`,
      icon: '/favicon.png',
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

export function markReminderTriggered(reminder: Reminder, at: Date = new Date()): Reminder {
  return { ...reminder, lastTriggeredAt: at.toISOString() };
}

/** Run due reminders; returns updated list if any were triggered. */
export function processDueReminders(
  reminders: Reminder[],
  catNameById: Record<string, string>,
  lang: 'zh' | 'en',
  now: Date = new Date()
): Reminder[] {
  if (readNotificationPermission() !== 'granted') return reminders;
  let changed = false;
  const next = reminders.map((r) => {
    if (!shouldTriggerReminder(r, now)) return r;
    const catName = catNameById[r.catId] ?? '';
    if (showReminderNotification(catName, r, lang)) {
      changed = true;
      return markReminderTriggered(r, now);
    }
    return r;
  });
  if (changed) saveReminders(next);
  return changed ? next : reminders;
}

export function repeatTypeLabel(repeatType: ReminderRepeatType, lang: 'zh' | 'en'): string {
  if (lang === 'zh') {
    if (repeatType === 'daily') return '每天';
    if (repeatType === 'weekly') return '每週';
    return '每月';
  }
  if (repeatType === 'daily') return 'Daily';
  if (repeatType === 'weekly') return 'Weekly';
  return 'Monthly';
}
