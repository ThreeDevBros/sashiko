
Goal

Fix the last 2 Live Activity issues on iOS:
1. stop the Live Activity from falling into the loading/stale state after a status change
2. make the expanded Live Activity ETA exactly match the ETA shown on `/order-tracking/:id`

What I found

- The loading problem is still in the server push path, not the widget layout. Backend logs still show `BadDeviceToken` warnings during Live Activity updates. That means some status-change pushes are still targeting an invalid or outdated token.
- The token registration is still a bit fragile: `src/lib/nativeLiveActivity.ts` saves the push token using a mutable `currentActiveOrderId` instead of the `activityId` returned by the native plugin event. That can attach a token to the wrong order after reopen/restart flows.
- The ETA mismatch is real in code:
  - Live Activity uses `estimated_ready_at + delivery_transit_minutes`
  - `/order-tracking/:id` uses `LiveOrderCountdown`, which recalculates with live Google Maps data and special-case UI rules
- So right now the page ETA and Live Activity ETA are not driven by the same source.

Plan

1. Make token registration exact and durable
- Refactor `src/lib/nativeLiveActivity.ts` to map native `activityId -> orderId` and persist tokens using the event’s `activityId`, not the mutable global order variable.
- Keep cleanup of old tokens, but tighten it so only the current valid token survives for that user/order.
- Update `setup/swift/LiveActivityPlugin.swift` only if needed to expose the activity/order mapping more explicitly.

2. Harden the status-change push path
- Update `supabase/functions/_shared/apns-live-activity.ts` to log final per-token outcome clearly, not just the first environment warning.
- Tighten failure handling in:
  - `supabase/functions/send-order-push/index.ts`
  - `supabase/functions/update-order-eta/index.ts`
- If a token is definitively bad, prune it immediately so later cron/status updates stop targeting dead tokens.

3. Unify ETA logic into one source of truth
- Refactor the customer-facing ETA logic so `/order-tracking/:id` uses the same formula as the Live Activity:
  - prep remaining from `estimated_ready_at`
  - plus persisted `delivery_transit_minutes`
- Remove the separate display-only rules in `LiveOrderCountdown` that currently create a different ETA path.

4. Make the page display match the Live Activity exactly
- Update:
  - `src/components/order/LiveOrderCountdown.tsx`
  - `src/pages/OrderTracking.tsx`
- The page should display the same remaining minutes the backend pushes to the Live Activity, so the user never sees two different ETAs.

5. Keep Google Maps only for refreshing transit data
- Continue using Google Maps to calculate/save `delivery_transit_minutes` when needed.
- But do not let that live recalculation create a second ETA shown to the user once the persisted ETA exists.

Files likely involved

- `src/lib/nativeLiveActivity.ts`
- `setup/swift/LiveActivityPlugin.swift`
- `src/components/order/LiveOrderCountdown.tsx`
- `src/pages/OrderTracking.tsx`
- `supabase/functions/_shared/apns-live-activity.ts`
- `supabase/functions/send-order-push/index.ts`
- `supabase/functions/update-order-eta/index.ts`

Expected result

- After a staff/admin status change, the Live Activity keeps updating instead of dropping into loading/stale state.
- The expanded Live Activity ETA and the `/order-tracking/:id` ETA are the same number at all times.
- Background cron refreshes and immediate status-change pushes both use the same valid token and the same ETA model.
