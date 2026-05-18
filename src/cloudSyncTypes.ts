export type CloudSyncPhase = 'idle' | 'loading' | 'syncing' | 'ready' | 'empty' | 'failed';

export type CloudSyncState = {
  phase: CloudSyncPhase;
  message: string | null;
  /** Selected cat daily row finished initial cloud pull (safe to upsert). */
  dailyHydrated: boolean;
};

export const initialCloudSyncState: CloudSyncState = {
  phase: 'idle',
  message: null,
  dailyHydrated: false,
};
