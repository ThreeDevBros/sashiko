import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook that detects app resume (from background) on both native Capacitor and web.
 * Calls `onResume` whenever the app becomes active again.
 */
export function useAppLifecycle(onResume: () => void) {
  const onResumeRef = useRef(onResume);
  onResumeRef.current = onResume;

  useEffect(() => {
    // Web fallback: visibility change
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        onResumeRef.current();
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
            onResumeRef.current();
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
