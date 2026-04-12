import { useEffect, useRef } from 'react';

/**
 * Hook that detects app resume (from background) on both native Capacitor and web.
 * Calls `onResume` whenever the app becomes active again.
 * 
 * Uses a GLOBAL singleton listener for Capacitor's `appStateChange` to prevent
 * duplicate listeners across multiple hook instances. Each hook instance registers
 * its callback into a shared set, and the single native listener invokes all of them.
 * 
 * Deduplicates events: on native, both `visibilitychange` and Capacitor `appStateChange`
 * fire — this hook ensures only one resume callback fires per wake cycle.
 */

type ResumeCallback = () => void | Promise<void>;

// ─── Global singleton state ───
// Only ONE native App.addListener is ever created, shared across all hook instances.
const resumeCallbacks = new Set<ResumeCallback>();
let globalListenerInitialized = false;
let lastGlobalResumeTime = 0;
const GLOBAL_THROTTLE_MS = 2000; // ignore duplicate resume within 2s

function fireAllResumeCallbacks() {
  const now = Date.now();
  if (now - lastGlobalResumeTime < GLOBAL_THROTTLE_MS) return;
  lastGlobalResumeTime = now;
  console.log('[AppLifecycle] Resume fired — notifying', resumeCallbacks.size, 'listeners');
  resumeCallbacks.forEach(cb => {
    try { cb(); } catch (e) { console.error('[AppLifecycle] Callback error:', e); }
  });
}

function initGlobalListener() {
  if (globalListenerInitialized) return;
  globalListenerInitialized = true;

  // Web: visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      fireAllResumeCallbacks();
    }
  });

  // Capacitor native: appStateChange — ONE listener for the entire app
  (async () => {
    try {
      const { App } = await import('@capacitor/app');
      await App.addListener('appStateChange', (state) => {
        if (state.isActive) {
          fireAllResumeCallbacks();
        }
      });
      console.log('[AppLifecycle] Global native listener registered');
    } catch {
      // Not on native — web fallback handles it
    }
  })();
}

export function useAppLifecycle(onResume: ResumeCallback) {
  const onResumeRef = useRef(onResume);
  onResumeRef.current = onResume;

  useEffect(() => {
    // Ensure global listener is initialized (idempotent)
    initGlobalListener();

    // Stable wrapper that always calls the latest callback ref
    const stableCallback: ResumeCallback = () => onResumeRef.current();
    resumeCallbacks.add(stableCallback);

    return () => {
      resumeCallbacks.delete(stableCallback);
    };
  }, []);
}
