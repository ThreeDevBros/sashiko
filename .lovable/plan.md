

# Plan: Apply OrderTracking Resume Pattern App-Wide

## Problem

When the app resumes from background on native iOS, only the `/order-tracking` page works because it has its own direct data refetch and realtime reconnection via `subscribeToResume`. The rest of the app relies on `queryClient.invalidateQueries()` in App.tsx, but this only refetches **active (mounted)** queries. When the user navigates away from OrderTracking to the homepage, the homepage queries mount fresh but may fail because:

1. The Supabase Realtime WebSocket may be stale/disconnected after backgrounding — individual components reconnect via `resumeCounter` from `subscribeToResume`, but the global resume handler doesn't force Realtime reconnection
2. There is **no web `visibilitychange` fallback** in App.tsx — the resume handler only works for native `appStateChange`, so if the native event is missed, nothing recovers
3. `handleGlobalResume` has a 1-second lock — if a second resume event fires during that window, it's silently skipped but `queryClient.invalidateQueries()` still runs (potentially with an un-refreshed session)

## Solution

### 1. Add `visibilitychange` web fallback in App.tsx

Add a `document.addEventListener('visibilitychange')` that runs the same resume logic. Use a shared throttle to prevent double-firing when both native `appStateChange` and `visibilitychange` trigger on the same resume.

### 2. Guard `invalidateQueries` behind `handleGlobalResume` success

`handleGlobalResume` currently returns `void`. Change it to return `boolean` indicating whether it actually ran (vs. was skipped due to lock). Only call `queryClient.invalidateQueries()` if it actually refreshed the session.

### 3. Force Supabase Realtime reconnection after resume

After session refresh, call `supabase.removeAllChannels()` is too aggressive. Instead, dispatch a global event (`appResumed`) that components can listen to for reconnection. But since components already use `subscribeToResume` for this, the real fix is ensuring `handleGlobalResume` always fires its subscribers — the issue is the 1-second lock preventing re-entry.

Reduce the lock timeout from 1000ms to 100ms, which still deduplicates rapid-fire events but doesn't block legitimate resume events that come slightly delayed.

## Files to modify

- **`src/lib/lifecycleManager.ts`** — Return `boolean` from `handleGlobalResume`; reduce lock timeout from 1000ms to 100ms
- **`src/App.tsx`** — Add `visibilitychange` listener alongside native handler; only invalidate queries when resume actually ran

## Technical details

```text
Before:
  appStateChange → handleGlobalResume (may skip if locked) → invalidateQueries (always runs)

After:
  appStateChange OR visibilitychange → handleGlobalResume → invalidateQueries (only if session refreshed)
  Lock reduced to 100ms to prevent true duplicate events only
```

