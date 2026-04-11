

# Plan: Fix Live Activity Updates, Simplify Widget Text, Match ETA, Fix Real-time on Resume

## Issues Found

1. **Live Activity doesn't auto-update on status change** — `send-order-push` IS called by staff/admin when changing status, and it DOES send APNs updates. The issue is the `contentState` in the APNs payload includes `orderId` as a string but the widget reads it. The real problem: the `send-order-push` function sends the correct Live Activity update, so this should work IF the push token was registered. Need to verify the `live_activity_tokens` table has tokens. The `update-order-eta` cron runs every 2 min for ETA refreshes — this part is correct.

2. **Live Activity still shows a title ("Order Placed", "Confirmed", etc.)** — The Swift widget has TWO text lines: `statusLabel` (bold title like "Preparing") and `statusMessage` (caption like "Our kitchen is preparing your order"). User wants ONLY the message text, no bold title. Need to restructure the widget to show only `statusMessage` as the primary text.

3. **ETA mismatch between Live Activity and /order-tracking** — The server-side ETA is `prep + delivery_transit_minutes` from the DB. But `LiveOrderCountdown` calculates transit via Google Maps Directions API live. If `delivery_transit_minutes` hasn't been saved to DB yet (or is stale), the Live Activity ETA won't match. The `saveTransitMinutes` function only runs once (`transitMinutesSaved.current`). Need to ensure transit minutes are saved early and that the server-side ETA calculation matches the client.

4. **Real-time stops working after leaving and reopening app** — The `useAppLifecycle` hook calls `loadOrderDetails()` on resume, which re-fetches data. But the Supabase Realtime channel may disconnect when the app is backgrounded and not automatically reconnect. The realtime subscription in the `useEffect` depends on `orderId` and `order?.status` — if status changes while backgrounded, the channel won't re-subscribe because the dependency didn't change from the component's perspective. Need to force-reconnect the realtime channel on app resume.

## Changes

### 1. Swift widget: Remove title, show only status message
**File: `setup/swift/OrderTrackingWidgetLiveActivity.swift`**
- Remove the `statusLabel` bold title text from the lock screen view
- Make `statusMessage` the primary (and only) text line with `.subheadline.bold` styling
- In Dynamic Island expanded: replace `statusLabel` with `statusMessage` in the leading region
- Remove the bottom region (which currently duplicates `statusMessage`)
- Keep the icon and ETA display as-is

### 2. Fix real-time reconnection on app resume
**File: `src/pages/OrderTracking.tsx`**
- Add a `resumeCounter` state that increments on each app resume via `useAppLifecycle`
- Include `resumeCounter` as a dependency of the realtime subscription `useEffect` — this forces the channel to tear down and re-subscribe on every resume
- This ensures the Supabase Realtime channel reconnects fresh after backgrounding

### 3. Ensure server-side ETA matches client ETA
**File: `src/pages/OrderTracking.tsx`**
- Remove the `transitMinutesSaved.current` guard so transit minutes can be re-saved if they change
- Save transit minutes on every calculation, not just once — use a ref to track last saved value and only update if different

### 4. Verify Live Activity contentState matches widget expectations
**Files: `supabase/functions/send-order-push/index.ts`, `supabase/functions/update-order-eta/index.ts`**
- Both already stringify all values — confirmed correct
- Update `statusMessage` in `send-order-push` to use simpler user-friendly text matching the new widget design (no emojis, cleaner text since it's the only text shown)

## Files to modify
1. `setup/swift/OrderTrackingWidgetLiveActivity.swift` — remove title, single message line
2. `src/pages/OrderTracking.tsx` — fix realtime reconnect on resume, re-save transit minutes
3. `supabase/functions/send-order-push/index.ts` — cleaner status messages (no title needed)

## Technical notes
- The realtime disconnect-on-background is a known Capacitor WebView issue — the WebSocket silently dies and Supabase JS client doesn't always auto-reconnect
- Forcing channel re-subscription via a counter dependency is the most reliable pattern
- Transit minutes re-saving ensures the cron job always has accurate data for Live Activity ETA

