import { useState, useCallback } from 'react';
import type { UserProfile, DailyLog } from './types';

const PROFILE_KEY = 'health_profile';
const LOGS_KEY = 'health_logs';

function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadLogs(): Record<string, DailyLog> {
  try {
    const raw = localStorage.getItem(LOGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function useHealthData() {
  const [profile, setProfileState] = useState<UserProfile | null>(loadProfile);
  const [logs, setLogsState] = useState<Record<string, DailyLog>>(loadLogs);

  const saveProfile = useCallback((p: UserProfile) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    setProfileState(p);
  }, []);

  const saveLog = useCallback((log: DailyLog) => {
    setLogsState(prev => {
      const next = { ...prev, [log.date]: log };
      localStorage.setItem(LOGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getLog = useCallback(
    (date: string): DailyLog | null => logs[date] ?? null,
    [logs]
  );

  return { profile, saveProfile, logs, saveLog, getLog };
}
