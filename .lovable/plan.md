## Goal

On **iOS only** (Capacitor native iOS app), change the "Need Directions? Open in Maps" buttons so:

1. The Google Maps PNG icon is replaced with a neutral map + pin icon (Lucide), to satisfy Apple's review guidance that we shouldn't promote a single third-party map.
2. Tapping the button opens a chooser letting the user pick **Google Maps** or **Apple Maps**, instead of jumping straight to Google Maps.
3. Where possible, use the iOS native share sheet (Capacitor `Share` plugin) so the system shows its built-in "Open in Maps / Open in Google Maps / Copy" menu (similar to the Instagram screenshot). If the native share sheet isn't available, fall back to an in-app bottom sheet with two options.

On **web and Android**, behavior and visuals stay exactly as they are today (Google Maps icon + direct link to Google Maps).

## Native picker feasibility

iOS does not expose a public "default maps app picker" API — apps like Instagram trigger it via `UIActivityViewController` (the share sheet) with a maps URL, and iOS then surfaces installed map apps as share targets. We can replicate this via Capacitor's `@capacitor/share` plugin, which wraps `UIActivityViewController`. This gives the native iOS look in the screenshot. If `Share.share` isn't supported at runtime, we fall back to our own bottom sheet with Google Maps / Apple Maps options.

## Files to change

1. **New helper** `src/lib/openDirections.ts`
   - `export const isIOSNative()` — `Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'`.
   - `openDirections({ lat, lng, label })`:
     - Web/Android: `window.open(googleMapsUrl, ...)` (current behavior).
     - iOS: try `Share.share({ url: appleMapsUrl, title: 'Directions to <label>' })` to invoke the native share sheet. The Apple Maps URL (`https://maps.apple.com/?daddr=lat,lng&q=label`) is universally handled — iOS will offer "Open in Maps" plus any installed map apps (Google Maps, Waze, etc.) as targets.
     - If `Share.share` throws / unsupported: open a controlled bottom sheet (state lifted to caller via a small `useDirectionsChooser()` hook returning `{ openFor, sheet }`).
   - `googleMapsUrl(lat, lng)` and `appleMapsUrl(lat, lng, label?)` exported helpers.

2. **New component** `src/components/DirectionsChooserSheet.tsx`
   - Bottom `Sheet` with two large rows:
     - Apple Maps (Lucide `MapPin` icon, system blue tint)
     - Google Maps (existing `googleMapsIcon` PNG)
   - Used only as the iOS fallback when the native share sheet is unavailable.

3. **Install plugin**: add `@capacitor/share` (locked to v7 per project memory) so `npx cap sync` picks it up. Register in the dynamic native plugin registry if the project uses one (per memory: "Native Plugin Architecture").

4. **Update the 3 button sites** to use the new helper and swap the icon on iOS:
   - `src/components/checkout/BranchInfoSheet.tsx` (line ~258 button, line ~261 icon)
   - `src/pages/OrderTracking.tsx` (line ~1073 button, line ~1077 icon)
   - `src/components/reservation/ReservationDetailSheet.tsx` (line ~199 anchor — convert to a `<button>` calling the helper, line ~205 icon)

   Icon swap pattern:
   ```tsx
   {isIOSNative() ? (
     <span className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
       <MapPin className="h-5 w-5 text-primary" />
     </span>
   ) : (
     <img src={googleMapsIcon} alt="Google Maps" className="h-9 w-9 rounded-md object-contain" />
   )}
   ```
   Button label stays "Need Directions? Open in Maps" on all platforms.

5. **i18n**: no new strings required — the existing label works for both flows.

## Out of scope

- `src/components/staff/StaffOrderMap.tsx` — internal staff tool, not user-facing in App Store review. Leave unchanged.
- Visuals on web and Android remain exactly as today.

## Verification

- iOS build: tap "Need Directions" on a pickup OrderTracking page, on the BranchInfoSheet from checkout, and on a reservation detail. Confirm native iOS share/maps sheet appears with both Apple Maps and Google Maps available.
- Web preview: button still shows Google Maps icon and opens Google Maps directly.
- After merging, user runs `npx cap sync` to pick up the new `@capacitor/share` plugin.
