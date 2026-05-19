/**
 * Pet Care notification service layer.
 *
 * Today: browser local notifications (Web Notification API).
 * Reserved: APNs, Firebase Cloud Messaging, Capacitor Push Notifications.
 *
 * All user-visible alerts (reminders, tests) should go through this module.
 */

import { safeGetItem, safeSetItem } from '../safeStorage';
import type { Reminder, ReminderKind } from '../reminders';

const PERMISSION_ASKED_KEY = 'cat-calendar-notification-asked';
const DEFAULT_ICON = '/favicon.png';

export type NotificationPermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

/** How the notification is delivered. Only `local` is active today. */
export type NotificationDeliveryChannel = 'local' | 'remote';

/** Future remote push backends (not wired yet). */
export type RemotePushBackend = 'apns' | 'fcm' | 'capacitor';

export type LocalNotificationPayload = {
  title: string;
  body: string;
  tag?: string;
  icon?: string;
  data?: Record<string, unknown>;
};

export type RemotePushRegistration = {
  backend: RemotePushBackend | null;
  token: string | null;
  error?: string;
};

export type NotificationServiceStatus = {
  permission: NotificationPermissionState;
  /** Browser Notification API available. */
  localSupported: boolean;
  /** User granted local notification permission. */
  localGranted: boolean;
  /** Active delivery channel for outbound alerts. */
  activeChannel: NotificationDeliveryChannel;
  /** Whether a remote push token is registered (always false until wired). */
  remoteRegistered: boolean;
  /** Backends prepared for future integration. */
  remoteBackendsPlanned: RemotePushBackend[];
};

// ---------------------------------------------------------------------------
// Browser local provider (Web Notification API)
// ---------------------------------------------------------------------------

function getBrowserNotification(): typeof Notification | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    if ('Notification' in window) {
      const wn = window.Notification;
      if (wn != null && typeof wn === 'function') return wn;
    }
  } catch {
    // ignore — iOS Safari / some PWAs throw on access
  }
  return undefined;
}

function readBrowserPermission(): NotificationPermissionState {
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

class BrowserLocalNotificationProvider {
  isSupported(): boolean {
    return getBrowserNotification() != null;
  }

  getPermission(): NotificationPermissionState {
    return readBrowserPermission();
  }

  async requestPermission(): Promise<NotificationPermissionState> {
    if (!this.isSupported()) return 'unsupported';
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
      return readBrowserPermission();
    } catch {
      return readBrowserPermission();
    }
  }

  show(payload: LocalNotificationPayload): boolean {
    if (readBrowserPermission() !== 'granted') return false;
    const N = getBrowserNotification();
    if (!N) return false;
    try {
      const n = new N(payload.title, {
        body: payload.body,
        tag: payload.tag,
        icon: payload.icon ?? DEFAULT_ICON,
        data: payload.data,
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
}

// ---------------------------------------------------------------------------
// Remote push stubs (APNs / FCM / Capacitor) — implement when native app ships
// ---------------------------------------------------------------------------

class RemotePushNotificationProvider {
  private registration: RemotePushRegistration = { backend: null, token: null };

  getRegistration(): RemotePushRegistration {
    return { ...this.registration };
  }

  isRegistered(): boolean {
    return Boolean(this.registration.token);
  }

  /** @future Capacitor `@capacitor/push-notifications` */
  async registerCapacitor(): Promise<RemotePushRegistration> {
    return {
      backend: 'capacitor',
      token: null,
      error: 'Capacitor push not configured',
    };
  }

  /** @future Apple Push Notification service (native iOS). */
  async registerApns(): Promise<RemotePushRegistration> {
    return {
      backend: 'apns',
      token: null,
      error: 'APNs not configured',
    };
  }

  /** @future Firebase Cloud Messaging (Android / optional iOS). */
  async registerFcm(): Promise<RemotePushRegistration> {
    return {
      backend: 'fcm',
      token: null,
      error: 'FCM not configured',
    };
  }

  /**
   * Placeholder for server-delivered push. No-op until backend + native SDK are wired.
   */
  async sendRemote(_payload: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<boolean> {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Notification service (facade)
// ---------------------------------------------------------------------------

class NotificationService {
  private readonly local = new BrowserLocalNotificationProvider();
  private readonly remote = new RemotePushNotificationProvider();

  getStatus(): NotificationServiceStatus {
    const permission = this.local.getPermission();
    const localSupported = this.local.isSupported();
    const localGranted = permission === 'granted';
    const remoteRegistered = this.remote.isRegistered();
    return {
      permission,
      localSupported,
      localGranted,
      activeChannel: remoteRegistered ? 'remote' : 'local',
      remoteRegistered,
      remoteBackendsPlanned: ['apns', 'fcm', 'capacitor'],
    };
  }

  isLocalSupported(): boolean {
    return this.local.isSupported();
  }

  getPermission(): NotificationPermissionState {
    return this.local.getPermission();
  }

  isGranted(): boolean {
    return this.getPermission() === 'granted';
  }

  async requestPermission(): Promise<NotificationPermissionState> {
    return this.local.requestPermission();
  }

  /** Deliver via local channel (browser). */
  sendLocal(payload: LocalNotificationPayload): boolean {
    return this.local.show(payload);
  }

  /** Deliver reminder alert — always routes through this service. */
  sendReminder(catName: string, reminder: Reminder, lang: 'zh' | 'en'): boolean {
    const { title, body } = buildReminderNotificationCopy(catName, reminder, lang);
    return this.sendLocal({
      title,
      body,
      tag: `cat-reminder-${reminder.id}`,
      data: { channel: 'local', reminderId: reminder.id, catId: reminder.catId },
    });
  }

  /** In-app test notification (settings / reminders page). */
  sendTestNotification(lang: 'zh' | 'en'): boolean {
    if (lang === 'zh') {
      return this.sendLocal({
        title: 'Pet Care',
        body: '測試通知成功 🐾 提醒功能運作正常。',
        tag: 'pet-care-test-notification',
        data: { channel: 'local', test: true },
      });
    }
    return this.sendLocal({
      title: 'Pet Care',
      body: 'Test notification 🐾 Reminders are working.',
      tag: 'pet-care-test-notification',
      data: { channel: 'local', test: true },
    });
  }

  /**
   * Future: register device for remote push (Capacitor → APNs/FCM).
   * Call from app bootstrap when native shell is ready.
   */
  async registerRemotePush(
    backend: RemotePushBackend = 'capacitor'
  ): Promise<RemotePushRegistration> {
    let reg: RemotePushRegistration;
    if (backend === 'apns') reg = await this.remote.registerApns();
    else if (backend === 'fcm') reg = await this.remote.registerFcm();
    else reg = await this.remote.registerCapacitor();
    return reg;
  }

  getRemoteRegistration(): RemotePushRegistration {
    return this.remote.getRegistration();
  }
}

export const notificationService = new NotificationService();

// ---------------------------------------------------------------------------
// Permission helpers (public API)
// ---------------------------------------------------------------------------

export function getNotificationSupport(): boolean {
  return notificationService.isLocalSupported();
}

export function getNotificationPermission(): NotificationPermissionState {
  return notificationService.getPermission();
}

export function isNotificationGranted(): boolean {
  return notificationService.isGranted();
}

export function getNotificationServiceStatus(): NotificationServiceStatus {
  return notificationService.getStatus();
}

export function wasNotificationPermissionAsked(): boolean {
  return safeGetItem(PERMISSION_ASKED_KEY) === '1';
}

export function markNotificationPermissionAsked(): void {
  safeSetItem(PERMISSION_ASKED_KEY, '1');
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  return notificationService.requestPermission();
}

export function sendLocalNotification(payload: LocalNotificationPayload): boolean {
  return notificationService.sendLocal(payload);
}

export function sendReminderNotification(
  catName: string,
  reminder: Reminder,
  lang: 'zh' | 'en'
): boolean {
  return notificationService.sendReminder(catName, reminder, lang);
}

export function sendTestNotification(lang: 'zh' | 'en'): boolean {
  return notificationService.sendTestNotification(lang);
}

export function permissionStatusLabel(
  permission: NotificationPermissionState,
  lang: 'zh' | 'en'
): string {
  if (permission === 'granted') return lang === 'zh' ? '已允許' : 'Allowed';
  if (permission === 'denied') return lang === 'zh' ? '已拒絕' : 'Denied';
  if (permission === 'default') return lang === 'zh' ? '尚未詢問' : 'Not asked yet';
  return lang === 'zh' ? '不支援' : 'Unsupported';
}

// ---------------------------------------------------------------------------
// Reminder notification copy (used only by service)
// ---------------------------------------------------------------------------

function buildReminderNotificationCopy(
  catName: string,
  reminder: Reminder,
  lang: 'zh' | 'en'
): { title: string; body: string } {
  const name = catName.trim() || (lang === 'zh' ? '寵物' : 'your pet');
  if (lang === 'zh') {
    switch (reminder.type as ReminderKind) {
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
  switch (reminder.type as ReminderKind) {
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
