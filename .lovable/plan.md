
# Plan: iOS Live Push Notifications + Google Hours Fix

## Part 1: iOS "Updating" Push Notifications (Collapsible Notifications via FCM)

### Current State
- Push notifications already fire on every status change via `send-order-push` edge function
- Live Activity infrastructure exists (`apns-live-activity.ts`, `nativeLiveActivity.ts`, `live_activity_tokens` table) but requires native Swift WidgetExtension — this is out of scope for Lovable
- The FCM push already sends on every status change — each one creates a separate notification on iOS

### What We Can Do (Backend + Web Side)
Since true iOS Live Activities require native Swift code in Xcode (WidgetExtension with ActivityKit), what we **can** implement is **collapsible FCM notifications** — where each status update replaces the previous notification on the user's screen instead of stacking. This uses FCM's `apns-collapse-id` header.

#### Changes:
1. **`supabase/functions/_shared/fcm-v2.ts`** — Add optional `collapseKey` to `FcmMessage` interface and pass it as `apns-collapse-id` in the APNs payload and `android.collapse_key` for Android
2. **`supabase/functions/send-order-push/index.ts`**:
   - Add `collapseKey: order_id` to each FCM message so all status updates for the same order replace the previous notification
   - Add driver proximity check: query `driver_locations` for the order, calculate distance to delivery address, and if within 10 meters, send a "Driver is arriving!" notification
   - Fix the `fcmSent` variable — currently `sendFcmV2` returns `FcmSendResult` (object), not a number
3. **New edge function `check-driver-proximity/index.ts`** — Called by `GlobalDriverTracker` on each location update to check if driver is within 10m of destination and trigger a push notification if so (only once per order)
4. **`src/components/driver/GlobalDriverTracker.tsx`** — After each successful location upsert, call the proximity check edge function

#### Database:
- Add `proximity_notified` boolean column to `driver_locations` table (default false) to prevent repeated "arriving" notifications

## Part 2: Google Hours Fetching Bug Fix

### Issue Found
In `fetch-google-reviews` edge function, the `buildOpeningHours` function has a bug with the Google Places API v1 response format:

- Google's `regularOpeningHours.periods` in the Places API (New) v1 uses a different structure than expected
- The v1 API returns periods with `open.day` as 0=Sunday through 6=Saturday, and `open.hour`/`open.minute` as separate fields
- The `formatTime` function checks `typeof time?.hour !== 'number'` which should work, but the `close` object structure in the v1 API includes a `date` wrapper for overnight hours
- The **real bug**: For places that close after midnight (overnight hours), the `close` period references the *next day*, but the code only maps `open.day` — it doesn't handle cross-day closing times
- Also, Google may return `truncated: true` when the schedule is complex, which isn't handled

### Fix:
1. **`supabase/functions/fetch-google-reviews/index.ts`**:
   - Handle overnight closing times (where `close.day !== open.day`)
   - Add logging to expose the raw Google response for debugging
   - Handle `truncated` periods gracefully
   - Fix the v1 API period structure: `open` and `close` objects contain `{ day, hour, minute }` directly (not nested in `time`)

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/_shared/fcm-v2.ts` | Add `collapseKey` support to FCM messages |
| `supabase/functions/send-order-push/index.ts` | Add collapse key, fix return type, add proximity notification |
| `supabase/functions/check-driver-proximity/index.ts` | New edge function for 10m proximity check |
| `src/components/driver/GlobalDriverTracker.tsx` | Call proximity check after location upsert |
| `supabase/functions/fetch-google-reviews/index.ts` | Fix overnight hours parsing, add debug logging |
| Migration | Add `proximity_notified` to `driver_locations` |

## Technical Details

**Collapsible notifications**: FCM supports `apns-collapse-id` (iOS) and `collapse_key` (Android) which replace existing notifications with the same key. Using `order_id` as the key means all updates for one order show as a single updating notification.

**Proximity check**: The `GlobalDriverTracker` already sends GPS every 10 seconds. After each upsert, it will call `check-driver-proximity` which uses the Haversine formula server-side to check if the driver is within 10m of the delivery address. If yes and not already notified, it sends a push to the customer.

**Google Hours**: The v1 Places API returns `{ open: { day: 0, hour: 9, minute: 0 }, close: { day: 0, hour: 17, minute: 0 } }` — the current parsing logic is mostly correct but fails for overnight hours where `close.day` differs from `open.day`.
