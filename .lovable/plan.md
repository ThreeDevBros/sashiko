

# Plan: Keep Live Activity ETA in Sync with Order Tracking Countdown

## Problem
The `LiveOrderCountdown` component ticks every 60 seconds and shows a decreasing ETA in the app UI, but the Live Activity widget on iOS only receives ETA updates during the 60s data poll or status changes. Between those events, the Live Activity shows a stale ETA.

## Solution
Add a callback from `LiveOrderCountdown` that fires every time `remainingMinutes` changes (every 60s tick). The parent `OrderTracking` page uses this to push the updated ETA to the Live Activity immediately.

## Changes

### 1. `src/components/order/LiveOrderCountdown.tsx`
- Add a new prop: `onRemainingMinutesChange?: (minutes: number | null) => void`
- Call it in a `useEffect` whenever `remainingMinutes` changes

### 2. `src/pages/OrderTracking.tsx`
- Pass `onRemainingMinutesChange` to `LiveOrderCountdown`
- In the callback, call `updateOrderLiveActivity` with the fresh ETA minutes (using the current order from a ref to avoid stale closures)
- Store `order` in a ref (`orderRef`) so the callback always has the latest order data

This means the Live Activity ETA will update every 60 seconds in lockstep with the in-app countdown, plus on every status change and poll — giving the user a perfectly synchronized experience.

## Files to modify
- `src/components/order/LiveOrderCountdown.tsx` — add callback prop + useEffect
- `src/pages/OrderTracking.tsx` — wire callback, add orderRef, push ETA to LA on every tick

