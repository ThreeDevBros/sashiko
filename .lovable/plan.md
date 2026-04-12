

# Plan: Fix App Resume, Live Activity Title, and Delivered Push

## Issue 1: App broken after close/reopen

**Root cause**: When the app resumes from background, `handleGlobalResume` refreshes the session but **never invalidates the React Query cache**. All queries remain stale with old data. Pages show stale/empty content, and new fetches don't trigger.

Additionally, there are **two competing native `appStateChange` listeners** — one in `App.tsx` (line 257) and one in `useAppLifecycle.ts` (`initGlobalListener`). Both fire on resume, creating race conditions.

**Fix** (`src/App.tsx`):
- After `handleGlobalResume(refreshSession)` completes, call `queryClient.invalidateQueries()` to force all active queries to refetch with the fresh session.

## Issue 2: Live Activity title disappears when ETA updates

**Root cause**: In `OrderTracking.tsx` line 236, the `handleRemainingMinutesChange` callback sends `statusMessage: ''` (empty string) to the Live Activity. This overwrites the title on every countdown tick.

**Fix** (`src/pages/OrderTracking.tsx`):
- Change `statusMessage: ''` to `statusMessage: getStatusMessageForOrder(currentOrder)` so the title is always included with ETA-only updates.

## Issue 3: Remove "Your Order has been delivered" FCM push

**Root cause**: In `send-order-push/index.ts` lines 118-141, FCM push notifications are sent for all terminal statuses (`delivered` and `cancelled`). Since the Live Activity already alerts the user on delivery, the FCM banner is redundant.

**Fix** (`supabase/functions/send-order-push/index.ts`):
- Only send FCM push for `cancelled` status, skip it for `delivered`.

## Files to modify
- `src/App.tsx` — Add `queryClient.invalidateQueries()` after resume session refresh
- `src/pages/OrderTracking.tsx` — Fix empty `statusMessage` in ETA tick callback
- `supabase/functions/send-order-push/index.ts` — Skip FCM for `delivered` status

