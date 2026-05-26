import { Capacitor } from '@capacitor/core';
import { isPetCareDevMode } from '../../lib/petCareDevMode';

export function isAuthNativeClient(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function authLog(event: string, data?: Record<string, unknown>): void {
  if (!isPetCareDevMode()) return;
  if (data) console.log(`[PC_AUTH] ${event}`, data);
  else console.log(`[PC_AUTH] ${event}`);
}
