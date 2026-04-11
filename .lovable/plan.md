

# Plan: Persistent Notification with Live ETA Countdown

## What We Need

1. **Notification stays until order finishes** — Use FCM's `ongoing` flag (Android) and remove auto-dismiss behavior. On iOS, the collapsible notification with time-sensitive priority already persists prominently, and we set `badge: 1` to keep it visible. On terminal statuses (delivered/cancelled), we send a final dismissal update.

2. **ETA updates every 2 minutes** — Create a new edge function `update-order-eta` that re-sends the collapsible notification with updated ETA text only (same status message, just recalculated minutes). A cron job calls this every 2 minutes for all active orders.

3. **Two types of updates**:
   - **Status change**: Updates both title/body text AND ETA (triggered by staff/admin)
   - **ETA refresh**: Updates only the ETA number, keeps the same status text (triggered by cron every 2 min)

## Changes

### 1. New Edge Function: `supabase/functions/update-order-eta/index.ts`
- Queries all active orders (status not in `delivered`, `cancelled`, `pending`) that have `estimated_ready_at` set
- For each order, calculates current ETA minutes
- Sends a collapsible FCM notification with the **same status message** but updated ETA
- Uses the same `collapseKey` (`order_${order_id}`) so it replaces the existing notification
- The notification body format: `{status_message} — Ready in ~{X} min`

### 2. Cron Job (via pg_cron)
- Schedule `update-order-eta` to run every 2 minutes
- Calls the edge function which batch-processes all active orders

### 3. Update `supabase/functions/_shared/fcm-v2.ts`
- Add `ongoing: true` to Android notification config (makes notification non-dismissable on Android)
- Add `sticky: true` to Android notification
- For terminal statuses, set `ongoing: false` so users can dismiss

### 4. Update `supabase/functions/send-order-push/index.ts`
- Add `ongoing: true` flag to FCM messages for non-terminal statuses
- On terminal statuses (`delivered`, `cancelled`), send with `ongoing: false` to release the notification
- Store the current status message in the `data` payload so the ETA refresh function can reuse it without recalculating

### 5. Store last status message for ETA-only refreshes
- Add `last_push_status` and `last_push_message` columns to `orders` table
- `send-order-push` writes these when sending a status update
- `update-order-eta` reads them to rebuild the notification body with just updated ETA

## Files to Create/Change

| File | Change |
|------|--------|
| `supabase/functions/update-order-eta/index.ts` | New function: batch ETA refresh for active orders |
| `supabase/functions/send-order-push/index.ts` | Add `ongoing` flag, store last status message |
| `supabase/functions/_shared/fcm-v2.ts` | Support `ongoing`/`sticky` Android flags, pass through to payload |
| Migration | Add `last_push_status`, `last_push_message` to `orders` table |
| pg_cron SQL | Schedule `update-order-eta` every 2 minutes |

## Technical Details

**Android `ongoing` notifications**: Setting `android.notification.sticky = true` and `android.ongoing = true` prevents the user from swiping away the notification. It stays pinned until we send a final update with `ongoing: false`.

**iOS persistence**: iOS doesn't support true "ongoing" notifications, but the combination of `time-sensitive` interruption level, collapsible ID, and regular 2-minute refreshes keeps the notification at the top of the notification center and constantly updated. Each refresh replaces the previous one.

**ETA format in notification**: The body will show the status text followed by the ETA, e.g.:
- `Our kitchen is preparing your order 👨‍🍳 — Ready in ~12 min`
- After 2 min refresh: `Our kitchen is preparing your order 👨‍🍳 — Ready in ~10 min`
- On status change: `Your order is on its way to you! 🚗 — Ready in ~5 min`

