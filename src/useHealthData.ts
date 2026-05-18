import { useState, useCallback } from 'react';
import type { UserProfile, DailyLog } from './types';
import { safeLoadJson, safeSetItem } from './safeStorage';

const PROFILE_KEY = 'health_profile';
const LOGS_KEY = 'health_logs';

function loadProfile(): UserProfile | null {
  const parsed = safeLoadJson<unknown>(PROFILE_KEY, null, 'health profile');
  if (!parsed || typeof parsed !== 'object') return null;
  return parsed as UserProfile;
}

function loadLogs(): Record<string, DailyLog> {
  const parsed = safeLoadJson<unknown>(LOGS_KEY, {}, 'health logs');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return parsed as Record<string, DailyLog>;
}

export function useHealthData() {
  const [profile, setProfileState] = useState<UserProfile | null>(loadProfile);
  const [logs, setLogsState] = useState<Record<string, DailyLog>>(loadLogs);

  const saveProfile = useCallback((p: UserProfile) => {
    safeSetItem(PROFILE_KEY, JSON.stringify(p));
    setProfileState(p);
  }, []);

  const saveLog = useCallback((log: DailyLog) => {
    setLogsState((prev) => {
      const next = { ...prev, [log.date]: log };
      safeSetItem(LOGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getLog = useCallback(
    (date: string): DailyLog | null => logs[date] ?? null,
    [logs]
  );

  return { profile, saveProfile, logs, saveLog, getLog };
}
