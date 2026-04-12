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

export async function handleGlobalResume(refreshSession: () => Promise<unknown>) {
  if (isHandlingGlobalResume) {
    console.log('[AppLifecycle] Resume skipped — handler already running');
    return;
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
  } finally {
    resumeUnlockTimer = setTimeout(() => {
      isHandlingGlobalResume = false;
      resumeUnlockTimer = null;
    }, 1000);
  }
}