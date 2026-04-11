

# Plan: Real-time Native Updates + Live Activities for Order Tracking

## Problems to Fix

1. **Order tracking page doesn't update in real-time on native** — The realtime Supabase subscription works on web but on native Capacitor WebView the connection can be flaky or silently fail. Need to add a polling fallback alongside the realtime channel for authenticated users.

2. **Active order banner on home page doesn't appear until app restart** — `ActiveOrderBanner` subscribes to a generic `active-order-home` realtime channel, but on native the subscription may not fire reliably. Need to add app resume/visibility detection to re-fetch active orders when the user returns to the app (Capacitor `App.addListener('appStateChange')`).

3. **Notification system should use Live Activities instead of standard push** — Replace the current FCM-based "ongoing sticky notification" approach with proper iOS Live Activities that show on the Lock Screen, Dynamic Island, and StandBy. The existing `nativeLiveActivity.ts` bridge and `apns-live-activity.ts` backend are already scaffolded but underutilized.

## Changes

### 1. Fix real-time updates on Order Tracking page
**File: `src/pages/OrderTracking.tsx`**
- Add a 10-second polling interval as a fallback alongside the existing realtime subscription for authenticated users (not just guests)
- On each poll, fetch the order and compare status — if changed, update state and show toast
- Import `App` from `@capacitor/app` and listen to `appStateChange` to refetch when app resumes from background

### 2. Fix Active Order Banner visibility on native
**File: `src/components/ActiveOrderBanner.tsx`**
- Add Capacitor `App.addListener('appStateChange')` to re-fetch active order when app resumes
- Reduce the realtime channel filter to user-specific orders (`filter: user_id=eq.${userId}`) to improve reliability
- Add a visibility-change listener (`document.addEventListener('visibilitychange')`) as a web fallback

### 3. Transition notification system to Live Activities
**File: `supabase/functions/send-order-push/index.ts`**
- Keep FCM push as a secondary/Android channel
- Prioritize Live Activity updates on iOS: when `live_activity_tokens` exist for the order, send the APNs Live Activity update as the primary notification
- For the initial order confirmation (no Live Activity token registered yet), still send FCM push — the client will start the Live Activity and register the token
- On terminal statuses, send `event: 'end'` to dismiss the Live Activity after 5 minutes

**File: `supabase/functions/update-order-eta/index.ts`**
- Add Live Activity ETA refresh alongside the FCM refresh
- Query `live_activity_tokens` for each active order and send APNs `contentState` updates with the new ETA

**File: `src/lib/nativeLiveActivity.ts`**
- Add an `updateOrderLiveActivity` function that updates the content state locally (status message + ETA) without restarting the activity
- Improve `startOrderLiveActivity` to calculate and pass `etaMinutes` from `estimated_ready_at`

**File: `src/pages/OrderTracking.tsx`**
- Start Live Activity immediately when order loads (not just on first render) and update it on every status change
- Pass calculated ETA minutes to the Live Activity
- End Live Activity when order reaches terminal status or user navigates away from a completed order

### 4. Add app lifecycle listeners
**File: `src/App.tsx` or new hook `src/hooks/useAppLifecycle.ts`**
- Create a reusable hook that listens to Capacitor `App.appStateChange` and `document.visibilitychange`
- Expose an `isActive` boolean and an `onResume` callback
- Use this in `ActiveOrderBanner` and `OrderTracking` to trigger refetches on resume

## Files to Create/Change

| File | Change |
|------|--------|
| `src/hooks/useAppLifecycle.ts` | New hook: Capacitor app state + visibility change listener |
| `src/components/ActiveOrderBanner.tsx` | Add resume-based refetch, user-scoped realtime filter |
| `src/pages/OrderTracking.tsx` | Add polling fallback, resume listener, improved Live Activity integration |
| `src/lib/nativeLiveActivity.ts` | Add `updateOrderLiveActivity`, pass ETA |
| `supabase/functions/update-order-eta/index.ts` | Add Live Activity APNs updates alongside FCM |
| `supabase/functions/send-order-push/index.ts` | Already sends Live Activity updates — ensure ETA is always included |

## Live Activity Content State Structure
The native Swift widget will receive this `contentState` on every update:
```json
{
  "status": "preparing",
  "orderNumber": "#042",
  "orderType": "delivery",
  "statusMessage": "Our kitchen is preparing your order 👨‍🍳",
  "etaMinutes": 12,
  "updatedAt": "2026-04-11T05:30:00Z"
}
```

This maps to:
- **Compact (Dynamic Island)**: Order number + ETA countdown
- **Minimal (Dynamic Island pill)**: ETA number only
- **Expanded**: Full status message + ETA + order number
- **Lock Screen**: Status icon + message + large ETA on the right

## Native Swift Requirements (documented, not code changes)
The user will need to implement in Xcode:
- A `WidgetExtension` with `ActivityConfiguration` using the content state schema above
- A custom Capacitor plugin `LiveActivityPlugin` that bridges `startActivity`, `updateActivity`, `endActivity`
- The `.p8` APNs auth key secrets (`APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_AUTH_KEY_P8`) must be configured

