export type SharedCareRole = 'owner' | 'member';

export type SharedCareMember = {
  id: string;
  name: string;
  role: SharedCareRole;
};

export type SharedCareActivity = {
  id: string;
  actor: string;
  summary: string;
  /** Local time HH:mm for MVP display */
  timeLabel: string;
};

export type SharedCareCatState = {
  members: SharedCareMember[];
  inviteCode: string | null;
  activities: SharedCareActivity[];
};

import { safeGetItem, safeLoadJson, safeRemoveItem, safeSetItem } from './safeStorage';

const STORAGE_KEY = 'cat-shared-care-mock-v1';

const DEMO_MEMBER_NAME = 'Amy';

export function getCareDisplayName(): string {
  const v = safeGetItem('cat-care-display-name')?.trim();
  return v || '';
}

export function setCareDisplayName(name: string): void {
  const t = name.trim();
  if (t) safeSetItem('cat-care-display-name', t);
  else safeRemoveItem('cat-care-display-name');
}

export function loadSharedCareMock(): Record<string, SharedCareCatState> {
  const parsed = safeLoadJson<Record<string, SharedCareCatState>>(
    STORAGE_KEY,
    {},
    'shared care mock',
    sessionStorage
  );
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

export function saveSharedCareMock(data: Record<string, SharedCareCatState>): void {
  safeSetItem(STORAGE_KEY, JSON.stringify(data), sessionStorage);
}

export function defaultOwnerName(lang: 'zh' | 'en'): string {
  const custom = getCareDisplayName();
  if (custom) return custom;
  return lang === 'zh' ? 'Wayne' : 'Wayne';
}

export function createDefaultSharedCareState(lang: 'zh' | 'en'): SharedCareCatState {
  const ownerName = defaultOwnerName(lang);
  return {
    members: [{ id: 'local-owner', name: ownerName, role: 'owner' }],
    inviteCode: null,
    activities: [],
  };
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i += 1) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

export function nowTimeLabel(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function makeActivityId(): string {
  return `act-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export { DEMO_MEMBER_NAME };
