

## Audit: API Keys and Cross-Platform Readiness

### Current State

**Secrets configured (backend):**
- `GOOGLE_MAPS_API_KEY` -- set
- `LOVABLE_API_KEY` -- set (managed)
- `STRIPE_PUBLISHABLE_KEY` -- set (excluded per your request)
- `STRIPE_SECRET_KEY` -- set (excluded per your request)

**Missing secrets:**
- `FCM_SERVER_KEY` -- NOT configured. Required by `send-broadcast-notification` edge function for push notifications on iOS/Android.

---

### Google Maps API Key -- Status: Working

The key is stored as a backend secret and served to the frontend via the `get-public-keys` edge function. This pattern works identically on **web, iOS, and Android** because:
- The frontend calls a backend function to get the key (no platform-specific code)
- Google Maps JS API is loaded via a `<script>` tag in the WebView (works in Capacitor)
- All geocoding is done server-side via edge functions (no platform dependency)

**No code changes needed.** The key just needs to be valid and have the following Google Cloud APIs enabled:
1. Maps JavaScript API
2. Places API
3. Geocoding API
4. Directions API (used for delivery time estimates)

**Action required from you:** Verify in your Google Cloud Console that all four APIs above are enabled for your key, and that the key has no HTTP referrer restrictions that would block requests from your native app's WebView (or set it to unrestricted / add your app bundle IDs).

---

### Push Notifications (FCM) -- Status: Incomplete

The code references `FCM_SERVER_KEY` but it is **not configured** as a secret. This means push notifications to iOS/Android devices will silently fail.

**Actions required from you:**
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Add your iOS app (bundle ID: `app.lovable.franchisefeasthub`) and Android app (same package name)
3. Download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) -- these go into your native project after `npx cap add ios/android`
4. Get the FCM Server Key from Firebase Console > Project Settings > Cloud Messaging
5. I will then store it as a backend secret called `FCM_SERVER_KEY`

---

### Capacitor Config -- Status: Needs Update

The current `capacitor.config.ts` is missing the `server` block for hot-reload during development. This doesn't affect production but is needed for testing on physical devices.

**Plan:** Update `capacitor.config.ts` with:
- Correct `appId`: `app.lovable.6e0c6b4d4b7943e7a8431d08565d9c10`
- Correct `appName`: `sashiko`
- `server.url` pointing to the sandbox preview for dev hot-reload

---

### Geolocation -- Status: Working (with caveat)

All geolocation uses the standard `navigator.geolocation` API which works in:
- **Web**: Native browser API
- **iOS/Android via Capacitor**: WebView supports `navigator.geolocation` natively

**Action required from you:** In your native iOS project (`Info.plist`), ensure `NSLocationWhenInUseUsageDescription` is set. For Android, ensure `ACCESS_FINE_LOCATION` permission is in `AndroidManifest.xml`. Capacitor usually adds these automatically when you `npx cap add ios/android`.

---

### Haptics -- Status: Working

The `useHaptics` hook uses `@capacitor/haptics` with try/catch fallbacks. On web it silently fails (correct behavior). On native it works automatically. **No changes needed.**

---

### Email Infrastructure -- Status: Working

All email is handled server-side via edge functions and the managed email domain (`notify.sashikoasianfusion.com`). **No platform dependency -- works on all platforms.**

---

## Summary of What YOU Need To Do

| Task | Platform | Status |
|------|----------|--------|
| Verify Google Maps API has all 4 APIs enabled | All | Manual check in Google Cloud Console |
| Remove/relax HTTP referrer restrictions on Google Maps key | iOS/Android | Manual check in Google Cloud Console |
| Create Firebase project and get FCM Server Key | iOS/Android | Manual setup in Firebase Console |
| Provide FCM Server Key so I can store it | iOS/Android | Tell me when ready |
| Add `google-services.json` to Android project | Android | After `npx cap add android` |
| Add `GoogleService-Info.plist` to iOS project | iOS | After `npx cap add ios` |

## What I Will Do (after your approval)

1. **Update `capacitor.config.ts`** with correct appId, appName, and dev server URL
2. **Store `FCM_SERVER_KEY`** as a backend secret once you provide it

No other code changes are needed -- the app architecture is already cross-platform compatible.

