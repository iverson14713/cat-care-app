/**
 * Pet Care notification service layer.
 *
 * Today: browser local notifications (Web Notification API).
 * Reserved: APNs, Firebase Cloud Messaging, Capacitor Push Notifications.
 *
 * All user-visible alerts (reminders, tests) should go through this module.
 */

import { safeGetItem, safeSetItem } from '../safeStorage';
import { APP_BRAND_ZH } from '../brand';
import type { Reminder, ReminderKind } from '../reminders';
import {
  buildPetCareNotificationCopy,
  getPetCareNotificationPermission,
  invalidatePetCareNotificationPermissionCache,
  isPetCareNativeLocalNotificationsAvailable,
  openPetCareNotificationSettings,
  requestPetCareNotificationPermission,
} from './petCareLocalNotifications';

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

function useNativeLocalChannel(): boolean {
  return isPetCareNativeLocalNotificationsAvailable();
}

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
    if (useNativeLocalChannel()) {
      return {
        permission: 'default',
        localSupported: true,
        localGranted: false,
        activeChannel: 'local',
        remoteRegistered: false,
        remoteBackendsPlanned: ['apns', 'fcm', 'capacitor'],
      };
    }
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
    return useNativeLocalChannel() || this.local.isSupported();
  }

  getPermission(): NotificationPermissionState {
    if (useNativeLocalChannel()) return 'default';
    return this.local.getPermission();
  }

  isGranted(): boolean {
    if (useNativeLocalChannel()) return false;
    return this.getPermission() === 'granted';
  }

  async requestPermission(): Promise<NotificationPermissionState> {
    if (useNativeLocalChannel()) {
      const native = await requestPetCareNotificationPermission();
      if (native === 'granted') return 'granted';
      if (native === 'denied') return 'denied';
      if (native === 'prompt') return 'default';
      return 'unsupported';
    }
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
        title: APP_BRAND_ZH,
        body: '通知驗證成功 🐾 提醒功能運作正常。',
        tag: 'pet-care-test-notification',
        data: { channel: 'local', test: true },
      });
    }
    return this.sendLocal({
      title: APP_BRAND_ZH,
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

function nativePermissionToAppState(
  native: Awaited<ReturnType<typeof getPetCareNotificationPermission>>
): NotificationPermissionState {
  if (native === 'granted') return 'granted';
  if (native === 'denied') return 'denied';
  if (native === 'prompt') return 'default';
  return 'unsupported';
}

export async function getNotificationPermissionAsync(
  forceRefresh = false
): Promise<NotificationPermissionState> {
  if (useNativeLocalChannel()) {
    const native = await getPetCareNotificationPermission(forceRefresh);
    return nativePermissionToAppState(native);
  }
  return notificationService.getPermission();
}

/** Re-read permission from the OS (bypass cache). Use on reminders page + app resume. */
export async function refreshNotificationPermission(): Promise<NotificationPermissionState> {
  if (useNativeLocalChannel()) {
    invalidatePetCareNotificationPermissionCache();
    return nativePermissionToAppState(await getPetCareNotificationPermission(true));
  }
  return notificationService.getPermission();
}

export function getNotificationPermission(): NotificationPermissionState {
  return notificationService.getPermission();
}

export function isNotificationGranted(): boolean {
  if (useNativeLocalChannel()) return false;
  return notificationService.isGranted();
}

export async function isNotificationGrantedAsync(): Promise<boolean> {
  if (useNativeLocalChannel()) {
    return (await getPetCareNotificationPermission(true)) === 'granted';
  }
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

/**
 * When the user creates a reminder, prompt for notification permission if not granted yet.
 * On native: shows the system dialog; if already denied, offers to open Settings.
 */
export async function promptNotificationPermissionForReminder(
  lang: 'zh' | 'en'
): Promise<NotificationPermissionState> {
  if (!getNotificationSupport()) return 'unsupported';

  if (useNativeLocalChannel()) {
    invalidatePetCareNotificationPermissionCache();
    let native = await getPetCareNotificationPermission(true);
    if (native === 'granted') return 'granted';
    native = await requestPetCareNotificationPermission();
    if (native === 'granted') return 'granted';
    if (native === 'denied') {
      const go = window.confirm(
        lang === 'zh'
          ? '建立提醒需要通知權限，時間到了才會收到推播。\n\n是否前往「設定」開啟通知？'
          : 'Reminders need notification permission to alert you on time.\n\nOpen Settings to enable notifications?'
      );
      if (go) openPetCareNotificationSettings();
      return 'denied';
    }
    return 'default';
  }

  const current = getNotificationPermission();
  if (current === 'granted') return 'granted';
  if (current === 'denied') {
    window.alert(
      lang === 'zh'
        ? '請在瀏覽器或系統設定中允許此網站的通知，提醒才會準時顯示。'
        : 'Allow notifications for this site in your browser or system settings so reminders can fire on time.'
    );
    return 'denied';
  }
  return requestNotificationPermission();
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

export function buildReminderNotificationCopy(
  catName: string,
  reminder: Reminder,
  lang: 'zh' | 'en'
): { title: string; body: string } {
  return buildPetCareNotificationCopy(catName, reminder, lang);
}
