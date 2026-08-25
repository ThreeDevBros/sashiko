# Tracking pill polish, toast removal, Live Activity parity

## 1. ETA text: drop the `~`
In the tracking status pill, the subline reads "Arriving in ~25 min". Remove the tilde everywhere the pill renders ETA, including the prep/drive breakdown line ("Prep 12 min + Drive 9 min").

## 2. Last bar stops flashing when complete
When the order is delivered/picked up (or cancelled), every segment of the progress rail renders solid — no pulsing animation on the final segment.

## 3. Remove every toast in the app
Full removal, as chosen: no toast UI remains anywhere, including admin, staff and driver panels.

- Delete all `toast(...)` / `toast.success` / `toast.error` calls across the app (~60 files) and their imports.
- Remove the mounted `<Toaster />` and `<Sonner />` from the app shell.
- Delete the toast infrastructure files (legacy `use-toast` hook, `ui/toast`, `ui/toaster`, `ui/sonner`, `components/ui/use-toast`), and remove the `sonner` dependency usage.
- Where a toast was the only signal for a failed action, the code keeps its existing behaviour (state reset, console error) but shows nothing — no replacement UI is added, per the chosen scope.

Note: admins/staff will no longer get "Saved" or "Failed to save" feedback in the management panels. Flagging it once; proceeding as requested.

## 4. Live Activity widget matches the tracking status pill
Rebuild the iOS Live Activity lock-screen and Dynamic Island layout so it mirrors the on-page status pill:

- Same headline wording ("Being prepared", "On the way", "Ready", "Delivered"/"Picked up") and the same subline ("Arriving in 25 min", "Waiting for the restaurant to confirm", "Enjoy your meal").
- Same segmented progress rail: 6 segments for delivery, 5 for pickup, filled up to the current stage, current segment gently pulsing, all solid when complete.
- Drop the circular status icon + big minute block in favour of the pill's typographic layout.
- Compact/minimal Dynamic Island slots keep the app icon and clock-time ETA.

To drive this, the Live Activity payload gains the fields the layout needs (order type and stage index) alongside the existing status/message/ETA values, and the app's update call sends the same strings the pill computes so both surfaces can never disagree.

## Technical notes
- `src/hooks/useOrderEta.ts` — `formatEta` output used without a tilde prefix in `TrackingStatusHero.tsx`.
- `src/components/order/TrackingStatusHero.tsx` — guard `animate-[trackingPulse...]` behind `!isDone`.
- Toast sweep touches ~60 files under `src/` plus `src/App.tsx` mount points.
- Live Activity: `setup/swift/OrderTrackingWidgetLiveActivity.swift` (layout), `src/lib/nativeLiveActivity.ts` and `supabase/functions/_shared/apns-live-activity.ts` (payload fields). Swift changes require rebuilding the iOS app in Xcode to take effect.
