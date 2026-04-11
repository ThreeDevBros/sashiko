

# Plan: Remake Live Activity Widget & Fix Server-Side Update Reliability

## Issues

1. **Compact Dynamic Island** — currently shows a status icon (left) and countdown like "30m" (right). User wants the **app icon** on the left and the **estimated delivery clock time** (e.g. "14:35") on the right.
2. **Expanded / Lock Screen** — currently shows only `statusMessage`. User wants the **status text with a status icon** and the **time remaining** (countdown).
3. **Order ID still visible** — `orderId` is referenced in `widgetURL` path and was previously shown. Remove all order-ID text from display (keep in URL for deep linking only).
4. **"Stuck on loading" after first update** — APNs logs show persistent `BadDeviceToken` on both production and sandbox environments. Every server-side push fails, so after the initial local update, the `staleDate` (120s) expires and the widget enters a stale/loading state. Root cause: the push token may be getting invalidated when the Live Activity is recreated or the app reopens, but the old token remains in the database.

## Changes

### 1. Redesign the Swift widget
**File: `setup/swift/OrderTrackingWidgetLiveActivity.swift`**

- **Compact Leading**: Replace status icon with the app icon using `Image("AppIcon")` (the asset catalog's app icon, or a dedicated small icon asset).
- **Compact Trailing**: Show the estimated delivery time as a clock time `HH:mm` instead of a countdown. Read a new `estimatedDeliveryTime` string from contentState (e.g. "14:35").
- **Expanded Leading**: Show status icon + status message text (e.g. "Preparing your food").
- **Expanded Trailing**: Show time remaining as countdown ("~25 min").
- **Lock Screen / Banner**: Same layout — status icon + status message on the left, time remaining on the right.
- **Minimal**: Keep app icon.
- Remove all references to `orderId` from displayed text. Keep it in `widgetURL` for deep linking.

### 2. Add `estimatedDeliveryTime` to contentState
**Files: `src/lib/nativeLiveActivity.ts`, `supabase/functions/send-order-push/index.ts`, `supabase/functions/update-order-eta/index.ts`**

- Compute the absolute delivery time as `now + etaMinutes` and format it as `HH:mm`.
- Add `estimatedDeliveryTime` as a new string field in the contentState sent both client-side and server-side.
- All values remain strings for Swift `[String: String]` Codable compatibility.

### 3. Fix "stuck on loading" — token refresh on every activity start
**File: `src/lib/nativeLiveActivity.ts`**

- The push token listener fires when ActivityKit provides a new token, but if the activity is ended and restarted (e.g. app reopened, new order), the old DB token becomes stale.
- Before starting a new activity, delete any existing `live_activity_tokens` for the user+order to avoid stale tokens.
- After starting, ensure the new push token overwrites via upsert.

### 4. Fix `staleDate` — increase or remove
**Files: `supabase/functions/send-order-push/index.ts`, `supabase/functions/update-order-eta/index.ts`**

- The current `staleDate` of 120-180 seconds is too aggressive. If the cron runs every 2 minutes but APNs delivery occasionally fails, the widget goes stale between updates.
- Increase `staleDate` to 600 seconds (10 minutes) to give ample buffer for the 2-minute cron cycle.

### 5. Improve APNs error handling
**File: `supabase/functions/_shared/apns-live-activity.ts`**

- When both environments return `BadDeviceToken`, delete the invalid token from `live_activity_tokens` to prevent repeated failures and allow re-registration.
- Pass `supabase` client or a cleanup callback into `sendLiveActivityUpdate` so it can prune dead tokens.

## Files to modify
1. `setup/swift/OrderTrackingWidgetLiveActivity.swift` — full redesign
2. `src/lib/nativeLiveActivity.ts` — add `estimatedDeliveryTime`, clean up stale tokens
3. `supabase/functions/send-order-push/index.ts` — add `estimatedDeliveryTime`, increase staleDate
4. `supabase/functions/update-order-eta/index.ts` — add `estimatedDeliveryTime`, increase staleDate
5. `supabase/functions/_shared/apns-live-activity.ts` — prune dead tokens on BadDeviceToken

## Technical notes
- The app icon in the compact Dynamic Island requires an image asset named "AppIcon" (or a small dedicated icon) in the widget extension's asset catalog. The developer will need to add this in Xcode.
- `estimatedDeliveryTime` is computed as `Date.now() + etaMinutes * 60000`, formatted to `HH:mm` in the user's timezone. Server-side uses UTC but the Swift widget will display it using the device's local timezone via `DateFormatter`.
- Alternatively, the Swift widget can compute the clock time itself from `etaMinutes` — this avoids timezone issues entirely. The widget would do `Date().addingTimeInterval(Double(mins) * 60)` and format locally.
- The persistent `BadDeviceToken` errors strongly suggest the stored push tokens are from a previous Live Activity session that was ended/invalidated. Cleaning them up and ensuring fresh registration on every activity start should resolve the "stuck on loading" issue.

