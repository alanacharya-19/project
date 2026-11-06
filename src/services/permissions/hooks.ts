import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { ScheduleCapabilities } from '@/types/reminder';
import { readCapabilities } from './index';

export function useCapabilities(enabled = true) {
  const [capabilities, setCapabilities] = useState<ScheduleCapabilities | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const snapshot = await readCapabilities();
      setCapabilities(snapshot);
      return snapshot;
    } catch {
      return null;
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [enabled, refresh]);

  return { capabilities, refreshing, refresh };
}
