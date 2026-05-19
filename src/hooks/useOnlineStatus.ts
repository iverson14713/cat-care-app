import { useEffect, useState } from 'react';
import { readIsOnline, subscribeOnlineStatus } from '../services/offlineSync';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => readIsOnline());

  useEffect(() => {
    return subscribeOnlineStatus(setOnline);
  }, []);

  return online;
}
