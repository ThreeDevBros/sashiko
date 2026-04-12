

# Plan: Sync Order Tracking Page and Live Activity — Same Data, Same Timing

## Current state

- The `/order-tracking` page has a **60s poll** that fetches fresh order data AND syncs the Live Activity — this is correct.
- The page also has a **realtime subscription** that updates status on change — this is correct.
- However, the realtime callback only calls `setOrder()` — it does **not** sync the Live Activity immediately on status change.
- The Live Activity also gets updated via a separate `useEffect` watching `order?.status` — but this fires asynchronously after the state update, introducing a small delay and potential race.

## What needs to change

### 1. Sync Live Activity immediately on realtime status change

In the realtime `postgres_changes` callback (line ~232–252), after `setOrder(...)`, also call `updateOrderLiveActivity()` inline with the fresh payload data. This ensures the Live Activity updates at the exact same moment the page does — no waiting for a React re-render cycle.

### 2. Sync Live Activity immediately on resume

The resume handler (line ~596) calls `loadOrderDetails()` but does not explicitly sync the Live Activity afterward. Add a `syncLiveActivity()` call after `loadOrderDetails()` completes.

### 3. Keep 60s poll as the fallback

No changes needed — it already fetches + syncs both page and Live Activity.

### 4. Keep the `useEffect` on `order?.status` as a safety net

This already handles start/end lifecycle. No removal needed — it acts as a catch-all.

## Files to modify

- **`src/pages/OrderTracking.tsx`** — Add `updateOrderLiveActivity` call inside the realtime callback; add `syncLiveActivity()` in the resume handler after data loads.

## AppIconSmall dimensions

For the Dynamic Island compact slots, `AppIconSmall` should be:

- **Size**: **48×48 pixels** (renders at 24×24 pt on @2x Retina)
- **Format**: PNG, no transparency, no rounded corners (the `clipShape` in SwiftUI handles rounding)
- **Location**: Add to the **widget extension's Asset Catalog** (not the main app target)
- If you want to support @3x as well, provide a **72×72 px** variant in the same image set

