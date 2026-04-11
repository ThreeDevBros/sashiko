import { useEffect, useRef } from 'react';

/**
 * Hook that detects app resume (from background) on both native Capacitor and web.
 * Calls `onResume` whenever the app becomes active again.
 * 
 * Deduplicates events: on native, both `visibilitychange` and Capacitor `appStateChange`
 * fire — this hook ensures only one resume callback fires per wake cycle.
 */
export function useAppLifecycle(onResume: () => void) {
  const onResumeRef = useRef(onResume);
  onResumeRef.current = onResume;

  useEffect(() => {
    let lastResumeTime = 0;
    const THROTTLE_MS = 1500; // ignore duplicate resume within 1.5s

    const fireResume = () => {
      const now = Date.now();
      if (now - lastResumeTime < THROTTLE_MS) return;
      lastResumeTime = now;
      onResumeRef.current();
    };

    // Web: visibility change
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fireResume();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Capacitor native: appStateChange
    let removeNativeListener: (() => void) | null = null;

    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const listener = await App.addListener('appStateChange', (state) => {
          if (state.isActive) {
            fireResume();
          }
        });
        removeNativeListener = () => listener.remove();
      } catch {
        // Not on native — web fallback handles it
      }
    })();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      removeNativeListener?.();
    };
  }, []);
}
