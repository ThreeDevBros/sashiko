

# Plan: Fix Live Activity Deep Link, Auto-Updates, ETA with Delivery Time, Remove Order ID

## Issues

1. **Tapping Live Activity doesn't open /order-tracking** — The Swift widget has no deep link URL configured. When tapped, it just opens the app to whatever screen it was on.

2. **Leaving order-tracking breaks home page data** — This is the same bootstrap/data loading regression from before. The `ActiveOrderBanner` on the home page should show the active order, and it does have its own fetch + realtime subscription. Need to investigate if the realtime channel is being properly cleaned up or if something else is interfering.

3. **Live Activity doesn't update automatically when status changes** — The server-side `send-order-push` function sends APNs updates, but the `contentState` sends `etaMinutes` as a `number | null` while the Swift `GenericAttributes.ContentState` expects `[String: String]`. APNs JSON delivers numbers as actual numbers, not strings, causing the Swift Codable decoder to fail silently and drop the update. The `update-order-eta` cron function has the same issue.

4. **ETA doesn't include delivery transit time** — Both edge functions compute ETA from `estimated_ready_at` only (prep time). For delivery orders, the Live Activity should show prep time + transit time. The `LiveOrderCountdown` component already calculates this using Google Maps Directions API, but the server-side functions don't have access to transit time. Solution: store a `delivery_transit_minutes` or compute a combined ETA and send that.

5. **Order ID still in the Live Activity title** — The `buildContentState` in `nativeLiveActivity.ts` still sends `orderNumber` in the content state. The Swift widget doesn't display it as a title (it uses `statusLabel`), but the field is still transmitted. The `nativeLiveActivity.ts` `LiveActivityData` interface still has `orderNumber` as a required field.

## Changes

### 1. Add deep link URL to Live Activity widget
**File: `setup/swift/OrderTrackingWidgetLiveActivity.swift`**
- Add `.widgetURL(URL(string: "sashiko://order-tracking/\(context.state.values["orderId"] ?? "")"))` to both the lock screen view and Dynamic Island expanded region
- The `orderId` needs to be passed in `contentState` (it's useful for navigation, not displayed)

**File: `capacitor.config.ts`**
- Ensure the app handles the `sashiko://` URL scheme (Capacitor handles this via `appUrlOpen` event)

**File: `src/App.tsx`**
- Add a listener for Capacitor's `appUrlOpen` event to navigate to `/order-tracking/:id` when the deep link is triggered

### 2. Fix contentState type mismatch (numbers vs strings)
**File: `supabase/functions/send-order-push/index.ts`**
- Convert `etaMinutes` to string in the `contentState`: `etaMinutes: etaMinutes != null ? String(etaMinutes) : ''`

**File: `supabase/functions/update-order-eta/index.ts`**
- Same fix: convert `etaMinutes` to `String(etaMinutes)`
- Ensure all `contentState` values are strings to match the Swift `[String: String]` Codable type

### 3. Include delivery transit time in server-side ETA
**File: `supabase/functions/send-order-push/index.ts`**
- After computing prep ETA from `estimated_ready_at`, also fetch the order's delivery address coordinates and branch coordinates
- Use a simple straight-line distance estimate (or store transit minutes on the order) to add delivery time
- For simplicity: add a `delivery_transit_minutes` column to orders, populated by the client when it calculates transit via Google Maps, then the edge functions can read it

**Database migration**: Add `delivery_transit_minutes integer` column to orders table

**File: `src/pages/OrderTracking.tsx`**
- When `LiveOrderCountdown` computes `transitMinutes` via Google Maps, save it to the order if not already saved: `supabase.from('orders').update({ delivery_transit_minutes: transitMinutes }).eq('id', orderId)`

**Files: `send-order-push/index.ts`, `update-order-eta/index.ts`**
- Read `delivery_transit_minutes` from the order and add it to `etaMinutes` for delivery orders

### 4. Remove orderNumber from contentState
**File: `src/lib/nativeLiveActivity.ts`**
- Remove `orderNumber` from `buildContentState` and `LiveActivityData` interface
- Add `orderId` to contentState (needed for deep linking, not displayed)

### 5. Fix home page data loading after leaving order-tracking
**File: `src/pages/OrderTracking.tsx`**
- Ensure realtime channel cleanup is correct (it looks correct already — `supabase.removeChannel(channel)` in cleanup)
- The issue may be that navigating back triggers a re-render of the home page before the bootstrap gate settles. Check if `ActiveOrderBanner` properly waits for `isAuthReady`

**File: `src/components/ActiveOrderBanner.tsx`**
- Already checks `isAuthReady` — this is likely fine. The real issue may be the realtime channel using a wildcard filter on the entire `orders` table. Scope it to the user's orders only.

## Files to modify
1. `setup/swift/OrderTrackingWidgetLiveActivity.swift` — add deep link URL
2. `src/App.tsx` — handle `appUrlOpen` deep link for order tracking
3. `supabase/functions/send-order-push/index.ts` — stringify contentState values, add transit time to ETA
4. `supabase/functions/update-order-eta/index.ts` — stringify contentState values, add transit time to ETA
5. `src/lib/nativeLiveActivity.ts` — remove `orderNumber`, add `orderId` to contentState
6. `src/pages/OrderTracking.tsx` — save transit minutes to DB for server-side use
7. Database migration — add `delivery_transit_minutes` column to orders
8. `src/components/ActiveOrderBanner.tsx` — scope realtime to user's orders to prevent stale state

## Technical notes
- The critical bug is the type mismatch: Swift's `Codable` for `[String: String]` silently fails when it receives a JSON number instead of a string. This is why server-side APNs updates aren't reflected in the widget.
- Deep linking uses a custom URL scheme (`sashiko://`) which Capacitor intercepts via the `appUrlOpen` event.
- Storing `delivery_transit_minutes` on the order avoids needing Google Maps API access in edge functions.

