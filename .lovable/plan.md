

# Plan: Polish Live Activity, Trim Push Notifications, Improve UX

## Summary
Make the Live Activity beautiful and user-friendly (no order ID, friendly status text, ETA), ensure it updates in real-time, and reduce push notifications to only the final "Enjoy your food" delivery notification.

## Changes

### 1. Update Swift Live Activity Widget — prettier layout, no order ID
**File: `setup/swift/OrderTrackingWidgetLiveActivity.swift`**

- Remove the "Order #XXX" text from both the Lock Screen view and the Dynamic Island
- Show only the user-friendly `statusMessage` as the primary text
- Show the ETA prominently (e.g. "~12 min" or "Arriving soon")
- Add a small progress-style feel: status icon + friendly message + ETA
- Lock Screen layout: icon | status message | ETA minutes
- Dynamic Island expanded: status message on bottom, ETA on trailing
- Dynamic Island compact: icon leading, ETA trailing
- Better status messages mapped in Swift for fallback (though JS sends the message)

### 2. Update JS content state with friendlier messages
**File: `src/pages/OrderTracking.tsx`**

- Update `getStatusMessage()` to return shorter, punchier messages suitable for the Lock Screen:
  - pending → "Waiting for confirmation"
  - confirmed → "Order confirmed!"
  - preparing → "Preparing your food 👨‍🍳"
  - ready (delivery) → "Ready — waiting for driver"
  - ready (pickup) → "Ready for pickup!"
  - out_for_delivery → "On its way to you!"
  - delivered → "Delivered — enjoy!"

### 3. Remove intermediate push notifications, keep only delivery completion
**File: `supabase/functions/send-order-push/index.ts`**

- Only send FCM push notifications for `delivered` and `cancelled` statuses
- Keep Live Activity updates for ALL status changes (so the widget stays current)
- This means the edge function still processes all statuses for Live Activity, but skips FCM for non-terminal statuses

**Files: `src/pages/admin/OrderManagement.tsx` and `src/pages/staff/StaffOrders.tsx`**

- No changes needed — they already call `send-order-push` for all statuses, and the edge function will now filter internally

### 4. Remove in-app toast notifications for intermediate statuses
**File: `src/pages/OrderTracking.tsx`**

- Remove `showStatusChangeToast()` calls for all statuses except `delivered` and `cancelled`
- The Live Activity on iOS handles real-time visual feedback now
- Keep the cashback earned toast on delivery
- Keep the delivered/cancelled toasts as they are terminal events

### 5. Ensure Live Activity updates on every status change
**File: `src/pages/OrderTracking.tsx`**

- The existing `useEffect` on `[order?.id, order?.status, isGuest]` already calls `updateOrderLiveActivity` — this is correct
- Add `order?.estimated_ready_at` to the dependency array so ETA changes also trigger updates

## Technical Details

- The Swift widget reads `statusMessage` and `etaMinutes` from `contentState.values` — no code path changes needed for data flow
- Server-side Live Activity push updates (APNs) will continue for all statuses via `send-order-push`
- FCM push will be gated to only `delivered`/`cancelled` in the edge function
- The `showStatusChangeToast` function stays but is only called for terminal statuses

## Files to modify
1. `setup/swift/OrderTrackingWidgetLiveActivity.swift` — remove order ID, cleaner layout
2. `src/pages/OrderTracking.tsx` — friendlier messages, remove intermediate toasts, add ETA to LA deps
3. `supabase/functions/send-order-push/index.ts` — skip FCM for non-terminal statuses

