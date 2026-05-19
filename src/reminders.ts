import { getAiPlan } from './aiClient';
import { safeGetItem, safeLoadJson, safeSetItem, storageError } from './safeStorage';

export const REMINDER_LIMIT_FREE = 3;
/** Effectively unlimited for Pro (test flow; no real billing yet). */
export const REMINDER_LIMIT_PRO = 100_000;

import {
  isNotificationGranted,
  sendReminderNotification,
  type NotificationPermissionState,
} from './services/notifications';

const STORAGE_KEY = 'cat-calendar-reminders';

export type { NotificationPermissionState };
export {
  getNotificationPermission,
  getNotificationSupport,
  requestNotificationPermission,
  wasNotificationPermissionAsked,
  markNotificationPermissionAsked,
} from './services/notifications';

export type ReminderRepeatType = 'daily' | 'weekly' | 'monthly' | 'once';

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
  /** YYYY-MM-DD for one-off reminders; null for repeating. */
  dueDate: string | null;
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
  const repeatType =
    o.repeatType === 'once' || o.repeatType === 'weekly' || o.repeatType === 'monthly'
      ? o.repeatType
      : 'daily';
  const repeatInterval = Math.max(1, Math.floor(Number(o.repeatInterval) || 1));
  const dueDate =
    repeatType === 'once'
      ? normalizeDueDate(typeof o.dueDate === 'string' ? o.dueDate : null) ?? getLocalDateKey()
      : null;
  return {
    id,
    catId,
    type,
    title,
    enabled: o.enabled !== false,
    time,
    repeatType,
    repeatInterval,
    dueDate,
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

export function normalizeDueDate(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(y, mo - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function getLocalDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function defaultDueDateDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return getLocalDateKey(d);
}

/** Whether this reminder should appear in a given day's schedule preview. */
export function reminderAppliesOnDate(reminder: Reminder, dateKey: string): boolean {
  if (!reminder.enabled) return false;
  if (reminder.repeatType === 'once') {
    return reminder.dueDate === dateKey;
  }
  return true;
}

export function getUpcomingOnceReminders(
  reminders: Reminder[],
  fromDateKey: string = getLocalDateKey()
): Reminder[] {
  return reminders
    .filter((r) => r.enabled && r.repeatType === 'once' && r.dueDate && r.dueDate > fromDateKey)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || a.time.localeCompare(b.time));
}

export function formatDueDateDisplay(dateKey: string, lang: 'zh' | 'en'): string {
  const m = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateKey;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  if (lang === 'zh') return `${y}年${mo}月${day}日`;
  const d = new Date(y, mo - 1, day);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatReminderSchedule(reminder: Reminder, lang: 'zh' | 'en'): string {
  if (reminder.repeatType === 'once' && reminder.dueDate) {
    return formatDueDateDisplay(reminder.dueDate, lang);
  }
  const label = repeatTypeLabel(reminder.repeatType, lang);
  if (reminder.repeatInterval > 1) {
    return `${label} ×${reminder.repeatInterval}`;
  }
  return label;
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
    dueDate: null,
    lastTriggeredAt: null,
  };
}

export function createCustomReminder(catId: string, partial: Partial<Reminder>): Reminder {
  const repeatType = partial.repeatType ?? 'daily';
  const dueDate =
    repeatType === 'once'
      ? normalizeDueDate(partial.dueDate ?? null) ?? getLocalDateKey()
      : null;
  return {
    id: makeReminderId(),
    catId,
    type: partial.type ?? 'custom',
    title: partial.title?.trim() || 'Reminder',
    enabled: partial.enabled !== false,
    time: normalizeTime(partial.time ?? '09:00'),
    repeatType,
    repeatInterval: repeatType === 'once' ? 1 : Math.max(1, partial.repeatInterval ?? 1),
    dueDate,
    lastTriggeredAt: null,
  };
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

  const today = getLocalDateKey(now);
  const last = reminder.lastTriggeredAt ? new Date(reminder.lastTriggeredAt) : null;
  const lastDay = last && !Number.isNaN(last.getTime()) ? getLocalDateKey(last) : '';

  if (reminder.repeatType === 'once') {
    if (!reminder.dueDate || reminder.dueDate !== today) return false;
    return !reminder.lastTriggeredAt;
  }
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
  if (!isNotificationGranted()) return reminders;
  let changed = false;
  const next = reminders.map((r) => {
    if (!shouldTriggerReminder(r, now)) return r;
    const catName = catNameById[r.catId] ?? '';
    if (sendReminderNotification(catName, r, lang)) {
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
    if (repeatType === 'once') return '指定日期';
    if (repeatType === 'daily') return '每天';
    if (repeatType === 'weekly') return '每週';
    return '每月';
  }
  if (repeatType === 'once') return 'Specific date';
  if (repeatType === 'daily') return 'Daily';
  if (repeatType === 'weekly') return 'Weekly';
  return 'Monthly';
}
