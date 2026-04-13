

# Fix: Live Activity ETA Mismatch with Order Tracking UI

## Problem

The Live Activity ETA calculation (`computeEtaMinutes` in OrderTracking.tsx and server-side functions) always uses `prepMinutes + transitMinutes` regardless of order status. But the in-app `DeliveryTimeEstimate` component uses status-aware logic:

- **`ready` status**: UI shows `transitMinutes + 5` (driver pickup buffer), Live Activity shows `0 + transitMinutes`
- **`out_for_delivery` status**: UI shows only `transitMinutes`, Live Activity shows `prepMinutes(≈0) + transitMinutes` (identical when prep is 0, but could differ if `estimated_ready_at` is in the past producing 0)
- The `+5 min driver pickup` buffer in `ready` status is never reflected in the Live Activity

## Fix

Make `computeEtaMinutes` status-aware to match the `DeliveryTimeEstimate` component logic. Apply the same fix to both server-side functions.

### 1. `src/pages/OrderTracking.tsx` — Update `computeEtaMinutes`

Add status-aware branching:
- `out_for_delivery`: return only `transitMinutes` (food is already on the way, prep time irrelevant)
- `ready` + delivery: return `transitMinutes + 5` (driver pickup buffer)
- `ready` + pickup: return `0`
- All other active statuses: return `prepMinutes + transitMinutes` (current behavior)

### 2. `supabase/functions/send-order-push/index.ts` — Same status-aware ETA

Update the ETA computation (lines 95-101) to use the same status-aware logic based on `new_status`.

### 3. `supabase/functions/update-order-eta/index.ts` — Same status-aware ETA

Update the ETA computation (lines 55-58) to use status-aware logic based on `order.last_push_status`.

### Files to modify
- `src/pages/OrderTracking.tsx` — `computeEtaMinutes` function
- `supabase/functions/send-order-push/index.ts` — ETA calculation block
- `supabase/functions/update-order-eta/index.ts` — ETA calculation block

