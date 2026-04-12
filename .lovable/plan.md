

# Plan: Simplify Live Activity Updates — 60s Poll + Resume Fetch

## Problem
The APNs push token system is unreliable (persistent `BadDeviceToken` errors cause the Live Activity to get stuck in a loading/stale state after status changes). The ETA shown on the Live Activity can also drift from the `/order-tracking` page.

## Approach
Instead of relying solely on fragile server-side APNs pushes, add a **60-second local polling loop** in OrderTracking that fetches the order and updates the Live Activity directly from the app. On app resume (`isActive: true`), immediately fetch and sync.

The server-side cron (`update-order-eta`) still handles background updates via APNs when the app is closed — but when the app is open, the local poll keeps the Live Activity perfectly in sync with the page.

## Changes

### 1. Add 60s Live Activity sync loop in `src/pages/OrderTracking.tsx`
- Merge the existing 10-second polling interval into a single 60-second loop that:
  1. Fetches fresh order data from DB
  2. Updates `setOrder(...)` (page UI)
  3. Calls `updateOrderLiveActivity(...)` with the same status + ETA the page displays
- This ensures the Live Activity and page always show identical data — no separate data paths.

### 2. Force-sync on app resume
- The existing `useAppLifecycle` handler already calls `loadOrderDetails()`. After that resolves, also call `updateOrderLiveActivity()` with the fresh data so the Live Activity snaps to correct values immediately on reopen.

### 3. Unify ETA computation
- Both the page display and the Live Activity update use `computeEtaMinutes(order)` — the single function already in OrderTracking. No separate server-side ETA formula visible to the user when the app is open.

### 4. Keep server-side cron for background
- `update-order-eta` (every 2 min) still pushes APNs updates for when the app is truly closed. No changes needed there — it's a fallback.
- The stale/loading issue is resolved because when the app is open, local updates keep the widget fresh regardless of APNs success.

## Files to modify

1. **`src/pages/OrderTracking.tsx`** — Replace the 10s poll with a 60s poll that also syncs the Live Activity. Add Live Activity update to the resume handler.
2. **`src/lib/nativeLiveActivity.ts`** — No structural changes needed; the existing `updateOrderLiveActivity()` function is already correct.

## What this fixes
- **Stuck loading**: When the app is open, local updates bypass APNs entirely. The widget never goes stale because it gets refreshed every 60s directly.
- **ETA mismatch**: Both page and Live Activity read from the same fetched order data and use the same `computeEtaMinutes()` function.
- **Resume sync**: Opening the app immediately fetches fresh data and pushes it to the Live Activity.

