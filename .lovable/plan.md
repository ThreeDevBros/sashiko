

# Plan: Fix App-Wide Data Fetching, Realtime, and Live Activity ETA

## Root Causes Found

### 1. CRITICAL: Realtime is completely broken
The `orders` table is **not added to the `supabase_realtime` publication**. This means the `postgres_changes` subscription in OrderTracking.tsx NEVER fires. The app relies entirely on 60s polling, which explains why it feels unresponsive and "stops working" — there are no instant updates at all.

### 2. Live Activity local updates fail after app restart
The Swift `LiveActivityPlugin` stores activity mappings in an **in-memory dictionary** (`activityMap: [String: String]`). When the app is killed and restarted by iOS, this map is empty. All subsequent `updateActivity` and `endActivity` calls fail silently with "Activity not found," so the ETA never updates from local calls.

### 3. Live Activity remote updates fail (APNs decode error)
The log shows `Unable to decode content state: The data couldn't be read because it is missing.` — this happens when stale Live Activities from previous sessions (started with a different content state format) receive APNs pushes they can't decode. The current format is correct (`{ values: { ... } }`), but old activities persist and fail.

### 4. Async side-effects inside `setOrder` functional updater
The realtime callback calls `void endOrderLiveActivity()` and `void updateOrderLiveActivity()` **inside** `setOrder(prev => { ... })`. These trigger native plugin calls, network requests, and storage writes from within a synchronous React state updater — an anti-pattern that can cause subtle render-cycle issues.

## Fixes

### Fix 1: Enable realtime on the `orders` table (DB migration)
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
```
This single line restores instant status updates to the tracking page.

### Fix 2: Persist `activityMap` in `LiveActivityPlugin.swift`
Change `activityMap` from in-memory to `UserDefaults`-backed storage. On startup, also scan `Activity<GenericAttributes>.activities` to rebuild the map from any still-running activities. This ensures `updateActivity` works even after a full app kill.

### Fix 3: Clean up stale activities on app launch
In `startOrderLiveActivity`, before starting a new activity, iterate over `Activity<GenericAttributes>.activities` and end any that aren't for the current order. This prevents "Unable to decode content state" errors from old activities receiving APNs pushes they can't decode.

### Fix 4: Move async Live Activity calls out of `setOrder` updater
In `OrderTracking.tsx`, extract the Live Activity sync logic from inside `setOrder(prev => { ... })` and run it **after** the state update using the merged order data:

```typescript
// Instead of:
setOrder(prev => {
  const updated = { ...prev, ...nextOrder };
  void updateOrderLiveActivity({...}); // BAD: async inside updater
  return updated;
});

// Do:
setOrder(prev => prev ? { ...prev, ...nextOrder } as Order : null);
// Then sync LA separately using the new status from payload
const mergedForLA = { ...(order || {}), ...nextOrder } as Order;
if (!isGuestRef.current && liveActivityStarted.current) {
  // sync outside the updater
}
```

### Fix 5: Make the 60s polling more resilient
Add a `try/catch` around `getSession()` in the polling interval with a retry fallback, so a transient auth issue doesn't kill polling permanently.

## Files to modify

- **DB migration** — `ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;`
- **`src/pages/OrderTracking.tsx`** — Move LA calls out of state updater; improve polling resilience
- **`setup/swift/LiveActivityPlugin.swift`** — Persist `activityMap` in `UserDefaults`; rebuild from running activities on init; clean up stale activities on start

