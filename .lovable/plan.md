

# Plan: Fix Staff Panel Orders Not Displaying

## Root Cause Analysis

After extensive investigation, I identified **two issues** that together cause the staff orders page to appear broken:

### Issue 1: `useHaptics` creates unstable function references
The `useHaptics` hook returns **new function references on every render** (no `useCallback`). This cascades through `useOrderAlerts`:
- `heavy` changes every render → `triggerVibration` changes → `startAlerts` changes → the alert effect re-runs on **every single render**
- This produces the flood of `🔕 Stopping order alerts` logs (dozens per second)
- The constant effect cleanup/re-run cycle can cause janky rendering and block the orders table from painting

### Issue 2: Silent query error handling
The orders query in `StaffOrders` uses `useQuery` but never surfaces errors. If the query fails (e.g., a PostgREST relationship error with the `profiles:user_id` or `order_items` join), the page silently shows "No orders found" instead of any error message.

## Changes

### 1. Fix `src/hooks/useHaptics.ts`
- Wrap all returned functions in `useCallback` with empty dependency arrays so they maintain stable references across renders
- This stops the cascade of effect re-runs in `useOrderAlerts`

### 2. Fix `src/hooks/useOrderAlerts.ts`
- Stabilize the `pendingOrderIds` dependency by using a ref-based comparison instead of relying on array identity
- Remove `startAlerts` and `stopAlerts` from the effect dependency array (use refs instead) to prevent effect re-runs from callback identity changes

### 3. Add error handling to `src/pages/staff/StaffOrders.tsx`
- Destructure `error` from the `useQuery` result
- Show an error message with retry button when the query fails, instead of silently showing "No orders found"
- Add `console.error` for the query failure

## Files to Change

| File | Change |
|------|--------|
| `src/hooks/useHaptics.ts` | Wrap all functions in `useCallback` |
| `src/hooks/useOrderAlerts.ts` | Use refs for callbacks to prevent effect re-runs |
| `src/pages/staff/StaffOrders.tsx` | Add error state handling to orders query |

