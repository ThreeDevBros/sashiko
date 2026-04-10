

## Fix: Device Tokens Not Reaching Database

### Root Cause

The logs confirm the problem clearly:
- Native Swift gets the FCM token: `[PushSetup] FCM token: fPLLKJqs1Eiyg3x_VATq...` 
- But the JS `registration` event **never fires** — there's no `[Push] Token received` log

This happens because **Firebase's method swizzling** intercepts the iOS `didRegisterForRemoteNotificationsWithDeviceToken` callback before Capacitor's PushNotifications plugin can process it. The plugin never receives the APNs token, so it never fires the `registration` event to JavaScript.

Additionally, even if it did fire, Capacitor would deliver the **APNs token** (hex string), not the **FCM token** that our FCM v2 API needs for sending.

### Solution

**Save the FCM token directly from Swift to the database via REST API**, bypassing the broken JS bridge entirely. Then use `@capacitor/preferences` to share the token with JS for user-linking on sign-in.

### Changes

**1. Install `@capacitor/preferences`**
- Lightweight Capacitor plugin that reads/writes `UserDefaults` from JS
- Used to bridge the FCM token value from native to JS

**2. Update `PushNotificationSetup.swift`**
- When FCM token is received via `messaging:didReceiveRegistrationToken:`:
  - Save token to `UserDefaults.standard` with key `cap_fcm_push_token` (readable by `@capacitor/preferences`)
  - POST token directly to Supabase REST API (`push_device_tokens` table) with `user_id = null`, `platform = ios`
  - Uses the public anon key (safe to embed — it's already in the web bundle)

**3. Rewrite `usePushNotifications.ts`**
- Remove reliance on `registration` event for token capture (it never fires)
- On app mount: read FCM token from `@capacitor/preferences`, save to DB (links user if authenticated)
- On `SIGNED_IN`: read FCM token from Preferences, update the DB row to set `user_id`
- Keep foreground notification handling (`pushNotificationReceived`, `pushNotificationActionPerformed`) unchanged
- Keep `registration` event listener as a safety fallback

**4. Update `scripts/setup-ios.sh`**
- No changes needed — the Swift file is manually dragged into Xcode

### Files Changed
- `package.json` — add `@capacitor/preferences`
- `ios/App/App/PushNotificationSetup.swift` — save FCM token to UserDefaults + Supabase REST
- `src/hooks/usePushNotifications.ts` — read token from Preferences, remove broken `registration` dependency

### After Deploying
Run: `npm install && npm run build && npx cap sync ios` then rebuild in Xcode. The Swift file needs to be replaced with the updated version.

### Harmless Log Warnings (No Action Needed)
- `FirebaseCore` "not yet configured" — timing log before AppDelegate runs
- `UIScene lifecycle` — iOS deprecation warning
- `DownloadFailed` — iOS system font/asset downloads, unrelated
- AutoLayout constraints — iOS system UI, not app code
- `RTIInputSystemClient` / `Reporter disconnected` — iOS keyboard internals

