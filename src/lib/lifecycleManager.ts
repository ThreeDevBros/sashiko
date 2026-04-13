type ResumeCallback = () => void | Promise<void>;

const resumeSubscribers = new Set<ResumeCallback>();
let isHandlingGlobalResume = false;
let resumeUnlockTimer: ReturnType<typeof setTimeout> | null = null;

export function subscribeToResume(callback: ResumeCallback) {
  resumeSubscribers.add(callback);

  return () => {
    resumeSubscribers.delete(callback);
  };
}

/**
 * Refreshes the auth session and notifies all resume subscribers.
 * Returns `true` if the handler actually ran, `false` if it was skipped (dedup lock).
 */
export async function handleGlobalResume(refreshSession: () => Promise<unknown>): Promise<boolean> {
  if (isHandlingGlobalResume) {
    console.log('[AppLifecycle] Resume skipped — handler already running');
    return false;
  }

  isHandlingGlobalResume = true;

  if (resumeUnlockTimer) {
    clearTimeout(resumeUnlockTimer);
    resumeUnlockTimer = null;
  }

  const startedAt = Date.now();
  console.log('[AppLifecycle] Resume started — subscribers:', resumeSubscribers.size);

  try {
    const refreshedSession = await refreshSession();
    console.log('[AppLifecycle] Session refresh settled — has session:', !!refreshedSession);

    const callbacks = Array.from(resumeSubscribers);
    const callbackResults = await Promise.allSettled(
      callbacks.map((callback) => Promise.resolve().then(() => callback()))
    );

    const rejectedCount = callbackResults.filter((result) => result.status === 'rejected').length;
    console.log('[AppLifecycle] Resume callbacks settled — total:', callbacks.length, 'rejected:', rejectedCount, 'durationMs:', Date.now() - startedAt);
    return true;
  } finally {
    // Short lock to deduplicate rapid-fire events only (native + visibility)
    resumeUnlockTimer = setTimeout(() => {
      isHandlingGlobalResume = false;
      resumeUnlockTimer = null;
      console.log('[AppLifecycle] Resume lock released');
    }, 100);
  }
}
