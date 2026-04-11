

# Plan: Clean Up Notifications, Polish Live Activity, Ensure Real-Time Updates

## Issues Found

1. **`update-order-eta` edge function still sends FCM push notifications every cycle** — it was never updated to be Live-Activity-only. It rebuilds FCM messages for every active order and sends them via `sendFcmV2`.

2. **`send-order-push` sends `alertTitle` and `alertBody` on Live Activity updates** — this causes iOS to show a banner notification alongside the Live Activity update for every status change. Live Activity updates should be silent content-state pushes, not alert pushes.

3. **No pg_cron job exists for `update-order-eta`** — so the function is never called automatically. Live Activities cannot update server-side without the app being open. A cron job (every 2 minutes) is needed to keep the ETA ticking down on the lock screen.

4. **Order tracking page does not react to `estimated_ready_at` changes in real-time** — the Supabase realtime subscription updates `order` state, but the Live Activity `useEffect` only depends on `order?.estimated_ready_at`. The `LiveOrderCountdown` component may not re-render if the ETA field on the payload isn't picked up. The polling interval is 10s which is fine, but the realtime channel should also trigger ETA refresh.

5. **Live Activity `contentState` still includes `orderNumber` field** — while the Swift widget doesn't display it as a title, it's still being sent and stored. The `statusMessage` from the edge function already contains user-friendly text. No order ID leaks into the widget UI (confirmed from Swift code), but the `alertTitle`/`alertBody` in the APNs push DO contain "Order #XXX" which shows as a notification banner.

## Changes

### 1. Remove FCM from `update-order-eta` — Live Activity only
**File: `supabase/functions/update-order-eta/index.ts`**
- Remove the entire FCM push block (lines 75-97)
- Remove the `sendFcmV2` import
- Keep only the Live Activity APNs update section
- This stops the periodic push notification pings

### 2. Remove alert fields from Live Activity pushes
**File: `supabase/functions/send-order-push/index.ts`**
- Remove `alertTitle`, `alertBody`, and `sound` from the Live Activity update objects (lines 167-169)
- This makes Live Activity updates silent content-state-only pushes — no banner notifications
- The status change is shown directly in the Live Activity widget on the lock screen

**File: `supabase/functions/update-order-eta/index.ts`**
- Same treatment — ensure no alert fields are sent in the ETA refresh Live Activity updates (already clean, just confirm)

### 3. Create pg_cron job for `update-order-eta`
**Database migration**
- Schedule `update-order-eta` to run every 2 minutes via pg_cron + pg_net
- This ensures Live Activities update on the lock screen without the app being open
- Uses the same pattern as the existing `process-email-queue` cron job

### 4. Ensure OrderTracking page updates in real-time
**File: `src/pages/OrderTracking.tsx`**
- The realtime subscription already calls `setOrder(prev => prev ? { ...prev, ...payload.new } : null)` which includes `estimated_ready_at` — this is correct
- Add `estimated_ready_at` to the Live Activity useEffect dependency so local LA updates also fire when ETA changes via realtime
- Ensure the `LiveOrderCountdown` component receives the latest `estimated_ready_at` from state (verify prop binding)

### 5. Remove `orderNumber` from Live Activity content state
**Files: `send-order-push/index.ts`, `update-order-eta/index.ts`**
- Remove `orderNumber` from the `contentState` object sent to APNs
- The Swift widget doesn't use it, so this is just cleanup
- Keep `status`, `statusMessage`, `etaMinutes`, `orderType`, `updatedAt`

## Files to modify
1. `supabase/functions/update-order-eta/index.ts` — remove FCM, remove orderNumber from contentState
2. `supabase/functions/send-order-push/index.ts` — remove alertTitle/alertBody/sound from LA updates, remove orderNumber from contentState
3. `src/pages/OrderTracking.tsx` — minor: ensure estimated_ready_at changes trigger LA update
4. Database migration — add pg_cron job for update-order-eta every 2 minutes

## Result
- No more push notification pings during order tracking
- Live Activity updates silently on the lock screen (status + ETA)
- Server-side cron keeps Live Activity fresh every 2 minutes without app open
- Only terminal statuses (delivered/cancelled) send a FCM push notification
- Order tracking page stays in sync via realtime + polling fallback

