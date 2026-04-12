

# Plan: Fix ETA Calculation and Stale State in Order Tracking + Live Activity

## Problems found

1. **Stale closure in realtime callback** — The realtime subscription (line 250) merges `payload.new` with the stale `order` from when the effect was created. After the first status change, subsequent updates merge with outdated data, losing fields like `delivery_transit_minutes`. This also explains "app stops working properly after first status update."

2. **ETA missing transit minutes** — `computeEtaMinutes` reads `delivery_transit_minutes` from the order object, but it can be null/undefined if: (a) the merge lost it, (b) it hasn't been saved to DB yet, or (c) the realtime payload didn't include it. The Live Activity then shows wrong ETA or empty.

3. **`isGuest` stale in realtime callback** — Captured from closure but not a dependency.

4. **LiveOrderCountdown shows "Calculating…"** when `deliveryTransitMinutes` is null, even though transit time was already computed by `useDynamicDeliveryInfo` elsewhere.

## Fixes

### 1. Fix stale closure in realtime callback (`OrderTracking.tsx`)

Replace `const updatedOrder = { ...(order || {}), ...payload.new }` with a functional state update that captures the fresh previous state:

```typescript
setOrder(prev => {
  if (!prev) return null;
  const updated = { ...prev, ...payload.new } as Order;
  
  // Sync Live Activity with the merged order (fresh, not stale)
  if (!isGuestRef.current && liveActivityStarted.current) {
    const isStillActive = !['delivered', 'cancelled'].includes(updated.status);
    if (isStillActive) {
      updateOrderLiveActivity({
        orderId: updated.id,
        orderType: updated.order_type,
        status: updated.status,
        statusMessage: getStatusMessageForOrder(updated),
        etaMinutes: computeEtaMinutes(updated),
      });
    }
  }
  
  return updated;
});
```

Add a `isGuestRef` (useRef) to avoid stale `isGuest` reads in the callback.

### 2. Fix ETA calculation for Live Activity

The `computeEtaMinutes` function correctly reads `delivery_transit_minutes` from the order object. But realtime `payload.new` only contains changed columns. When status changes but `delivery_transit_minutes` doesn't, the merge must preserve the old value. Fix #1 above (using `prev` state) solves this — the previous state already has `delivery_transit_minutes`.

### 3. Ensure `delivery_transit_minutes` is persisted early

The `saveTransitMinutes` callback is passed to `LiveOrderCountdown` via `onTransitMinutesCalculated`, but `LiveOrderCountdown` no longer calls it (the prop exists but is unused since transit comes from the DB). Need to ensure transit minutes are saved when the order tracking page first loads — use the `DeliveryTimeEstimate`-style Google Directions call or the existing `useDynamicDeliveryInfo` pattern to calculate and persist transit on first load.

Actually, looking more carefully, `LiveOrderCountdown` doesn't calculate transit at all — it only reads `deliveryTransitMinutes` from props. The transit is supposed to already be in the DB from when the order was placed. If it's missing, the ETA shows "Calculating…" forever.

**Fix**: In `loadOrderDetails`, after loading the order, if `delivery_transit_minutes` is null and it's a delivery order with coordinates, compute transit via Google Directions and save it.

### 4. End Live Activity on terminal status in realtime callback

When status becomes `delivered`/`cancelled`, call `endOrderLiveActivity` immediately in the callback instead of waiting for the `useEffect` on `order?.status`.

## Files to modify

- **`src/pages/OrderTracking.tsx`** — Fix stale closure, add isGuestRef, compute transit on first load if missing, end activity in realtime callback

## Technical details

- Use `useRef` for `isGuest` to avoid stale reads in realtime/poll callbacks
- Use functional `setOrder(prev => ...)` pattern to get fresh merged state
- Add a one-time transit calculation in `loadOrderDetails` when `delivery_transit_minutes` is null for delivery orders
- Keep `syncLiveActivity` for resume path (already correct since it uses functional `setOrder`)

