

# Plan: Fix "Loading/Calculating" State on Status Change

## Root Cause

When the order status changes (e.g., to `out_for_delivery`), two things show a loading state:

1. **In-app `LiveOrderCountdown`** shows "Calculating…" because `remainingMinutes` is `null`. For `out_for_delivery` status, it returns `transitMinutes ?? null` — if `delivery_transit_minutes` is null, it falls through to the "Calculating…" fallback.

2. **Swift Live Activity widget** shows a small dot instead of ETA when `etaMinutes` is empty.

The underlying issue: `delivery_transit_minutes` may be `null` in the database if the fire-and-forget computation in `loadOrderDetails` failed or never ran. Additionally, even when transit minutes exist, the `LiveOrderCountdown` component has edge cases where `remainingMinutes` returns `null` unnecessarily.

## Fixes

### 1. `LiveOrderCountdown` — never show "Calculating…" after initial load

- For `out_for_delivery` and `ready` (delivery): if `transitMinutes` is null, show a fallback estimate (e.g., "~15 min") instead of "Calculating…"
- For `confirmed`/`preparing`: if `estimatedReadyAt` exists but transit is null, show prep time only (don't block on missing transit)
- Only show "Calculating…" for the brief initial `pending` → `confirmed` window

### 2. `Order` interface — add `delivery_transit_minutes`

Add the field to the `Order` interface in `OrderTracking.tsx` so it's properly typed and preserved through state updates without needing `as any` casts.

### 3. Ensure transit minutes are computed on first status change

In the realtime callback, if the incoming status is `confirmed` or later and `delivery_transit_minutes` is still null on the merged order, trigger the transit computation immediately (same logic as `loadOrderDetails` but non-blocking).

### 4. Swift widget — show status message when ETA is unavailable

The compact trailing slot currently shows a tiny dot when ETA is empty. Instead, show the status icon so it's informative rather than looking broken.

## Files to modify

- **`src/components/order/LiveOrderCountdown.tsx`** — Remove "Calculating…" fallback; show prep-only or fallback estimate
- **`src/pages/OrderTracking.tsx`** — Add `delivery_transit_minutes` to Order interface; trigger transit computation in realtime callback if missing
- **`setup/swift/OrderTrackingWidgetLiveActivity.swift`** — Show status icon instead of dot when ETA is unavailable

