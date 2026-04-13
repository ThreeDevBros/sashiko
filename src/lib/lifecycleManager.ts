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

  try {
    await refreshSession();

    const callbacks = Array.from(resumeSubscribers);
    await Promise.allSettled(
      callbacks.map((callback) => Promise.resolve().then(() => callback()))
    );
    return true;
  } finally {
    // Short lock to deduplicate rapid-fire events only (native + visibility)
    resumeUnlockTimer = setTimeout(() => {
      isHandlingGlobalResume = false;
      resumeUnlockTimer = null;
    }, 100);
  }
}