

# Plan: Enhanced iOS Order Notifications

## Issues Found

1. **404 on notification tap** — The push handler navigates to `/order/${data.order_id}` but the actual route is `/order-tracking/${orderId}`. No `/order/:id` route exists.
2. **No ETA in notification body** — The `estimated_ready_at` is already fetched from the database but never included in the notification text.
3. **Not time-sensitive** — iOS supports `interruption-level: time-sensitive` in the APNs payload which makes notifications always appear prominently at the top of the lock screen and break through Focus modes.
4. **Small notification size** — Adding `mutable-content: 1` and a notification `category` enables the system to show an expanded notification layout on iOS.

## Changes

### 1. Fix navigation path (client-side)
**`src/hooks/usePushNotifications.ts`**
- Change both navigation calls from `/order/${data.order_id}` to `/order-tracking/${data.order_id}`
- Line 109: foreground toast action
- Line 121: background tap handler

### 2. Add ETA to notification body (backend)
**`supabase/functions/send-order-push/index.ts`**
- After building the status message, append the ETA when `estimated_ready_at` exists
- Example: "Your order is being prepared — Ready in ~12 min"

### 3. Make notifications time-sensitive (backend)
**`supabase/functions/_shared/fcm-v2.ts`**
- Add `interruption-level: time-sensitive` to the APNs `aps` payload
- Add `relevance-score: 1.0` so iOS prioritizes it
- Add `mutable-content: 1` to enable rich/expanded notification display
- Add `category: ORDER_STATUS` to allow iOS to use expanded notification templates
- Add `thread-id` using the collapse key so iOS groups notifications per order

### 4. Add priority headers (backend)
**`supabase/functions/_shared/fcm-v2.ts`**
- Set `apns-priority: 10` (immediate delivery) in APNs headers
- Set `android.priority: high` for Android equivalent

## Files to Change

| File | Change |
|------|--------|
| `src/hooks/usePushNotifications.ts` | Fix navigation path to `/order-tracking/` |
| `supabase/functions/_shared/fcm-v2.ts` | Add time-sensitive, mutable-content, category, thread-id, high priority |
| `supabase/functions/send-order-push/index.ts` | Append ETA to notification body text |

## Technical Notes

- **Time-sensitive notifications** require the `com.apple.developer.usernotifications.time-sensitive` entitlement in the native iOS app. If this entitlement is not already configured in Xcode, the flag will be silently ignored by iOS (no error, just treated as normal priority). You may need to enable this capability in Xcode under Signing & Capabilities.
- **mutable-content** enables iOS Notification Service Extensions to modify the notification before display (e.g., attach images or expand content).
- The `category` field (`ORDER_STATUS`) can later be used with native UNNotificationCategory to add custom action buttons.

