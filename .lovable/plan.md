# Spring scrolling, calmer tracking pill, native-matching Live Activity colours

## 1. Spring (rubber-band) scrolling on iOS + Android

Today the app suppresses bounce in places: `html` uses `overflow-y: scroll` with a scrollbar gutter, and several screens set `overscrollBehavior: 'none'` / `'contain'` (Auth, TableBooking, Checkout drawer scrollers, floor-plan canvas).

Changes:
- Allow rubber-band on the main document scroller: keep the layout as-is but let `html`/`body` use the platform's default overscroll (`overscroll-behavior: auto`) and enable momentum scrolling (`-webkit-overflow-scrolling: touch`) so iOS gives its native spring and Android 12+ gives its stretch effect.
- Remove the blanket `overscroll-behavior: none` on the Auth page (it was added to stop page shifting, not to kill bounce) so that page also springs.
- Keep `overscroll-behavior: contain` only where it is functionally required: inner drawer/sheet scrollers, the floor-plan canvas, and the map surfaces — those must not chain scroll to the page. Inner sheet scrollers still get momentum scrolling so they bounce inside their own bounds.
- No change to safe-area padding, sticky bars, or drawer behaviour.

Note: the visible spring only exists in the native app / mobile browsers; desktop Chrome will look unchanged.

## 2. Global: drop the detailed ETA breakdown, slow the progress rail

- Remove the "Prep 12 min + Drive 9 min" line from the tracking status pill entirely. The "Arriving in 25 min" subline stays as the only ETA.
- Slow the pulsing of the current progress segment substantially (from 2.6s to a much longer, gentler cycle around 6s, with a shallower opacity dip) so it reads as a slow breath instead of a flicker.
- Completed/cancelled orders still render every segment solid with no animation.

## 3. iOS only: Live Activity colours match the app exactly

The widget currently uses system colours (`.accentColor`, `.primary`, `.secondary`), so it picks up iOS tinting rather than the app's palette.

- Define the app's palette in the widget as explicit colours converted from the app's design tokens: gold primary (`hsl(43 96% 56%)`), dark card background (`hsl(240 4% 17%)`), foreground (`hsl(0 0% 93%)`), and a muted foreground for inactive segments.
- Use those in the headline, subline, and progress rail so the widget is a pixel-level match of the in-app status pill, and give the activity the app's card background tint instead of a clear/system background.
- Mirror the same two changes from section 2 in the widget: no prep/drive breakdown, and the same slow pulse timing on the current segment.

## Technical notes
- Files touched: `src/index.css` (overscroll/momentum + `trackingPulse` keyframes), `src/pages/Auth.tsx` (drop `overscrollBehavior: 'none'`), `src/components/order/TrackingStatusHero.tsx` (remove breakdown block + slower pulse), `setup/swift/OrderTrackingWidgetLiveActivity.swift` (colour constants + pulse + no breakdown).
- Presentation only — no ETA maths, pricing, or backend changes. `useOrderEta` keeps returning the prep/transit values; they just stop being rendered.
- Swift changes require copying the file into the widget target and rebuilding in Xcode.
