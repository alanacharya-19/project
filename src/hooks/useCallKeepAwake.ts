import { useEffect } from 'react';
import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from 'expo-keep-awake';

/**
 * Holds the screen awake for the duration of a call screen. The Expo hook
 * throws on some platforms when the lock is released before activation
 * resolves, which would crash the call UI, so the lifecycle is handled
 * explicitly and failures are treated as non-fatal.
 */
export function useCallKeepAwake(): void {
  useEffect(() => {
    const tag = `ringo-call-${Math.random().toString(36).slice(2)}`;
    let mounted = true;
    let activated = false;

    const release = () => {
      try {
        deactivateKeepAwake(tag);
      } catch {
        // The lock was never acquired; nothing to release.
      }
    };

    activateKeepAwakeAsync(tag)
      .then(() => {
        activated = true;
        // The screen may have closed while activation was in flight.
        if (!mounted) release();
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
      if (activated) release();
    };
  }, []);
}
