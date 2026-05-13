import { useState, useEffect } from 'react';
import api from '@/services/api';

export function useOnlineStatus(intervalMs = 30000) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        await api.get('/health', { timeout: 5000 });
        setIsOnline(true);
      } catch {
        setIsOnline(false);
      }
    };

    check();
    const interval = setInterval(check, intervalMs);

    const goOnline = () => check();
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [intervalMs]);

  return isOnline;
}
