
What’s actually going on:

1. Token registration is now mostly working
- Your logs show:
  - `[Push] Token saved to database (guest)`
  - `[Push] Token saved to database (authenticated)`
- So the app is successfully obtaining an iOS FCM token and the web hook is storing it.

2. The main failure is now on the send side, not the save side
- The backend send logs show:
  - `THIRD_PARTY_AUTH_ERROR`
  - `ApnsError ... 403 ... InvalidProviderToken`
- That means Firebase is trying to hand the push to Apple, and Apple is rejecting the credentials.
- In plain English: the device token exists, but the Apple push credentials connected to Firebase are invalid for this app.

3. Why this proves it’s not a guest-user problem
- The same send error appears for valid FCM-style iOS tokens like:
  - `cwIShwWc...`
  - `fW00xN_xx0...`
  - `fe0JfpN8...`
- So guest/auth status is not the blocker anymore.
- The blocker is Apple/Firebase push configuration.

4. There is also one secondary cleanup issue
- The send logs also show one token like:
  - `670B8AF54C...`
- That looks like an APNs token, not an FCM token.
- Your current hook already ignores the iOS Capacitor registration token, which is good, but an older bad token is still in the database and should be filtered/cleaned up.

Exactly what the problem is:
- Firebase Cloud Messaging is configured enough to mint FCM tokens on-device.
- But the Apple push credentials behind that Firebase project are wrong, revoked, expired, or mapped to the wrong app/bundle/environment.
- Most likely causes:
  1. Missing or invalid APNs auth key/certificate in Firebase
  2. Firebase iOS app configuration doesn’t match your real iOS bundle ID
  3. `GoogleService-Info.plist` belongs to a different Firebase app/project than the service account used by the backend
  4. Old APNs-format tokens are still being attempted

Files/systems involved:
- `supabase/functions/_shared/fcm-v2.ts`
- `supabase/functions/send-broadcast-notification/index.ts`
- `src/hooks/usePushNotifications.ts`
- `.lovable/plan.md`
- Your local Xcode project:
  - `GoogleService-Info.plist`
  - `AppDelegate.swift`
  - `PushNotificationSetup.swift`
  - iOS bundle identifier / signing settings

What I would change next once approved:

1. Add stronger backend diagnostics
- Log token classification (`fcm` vs `apns-like`)
- Log Firebase project id used by `FIREBASE_SERVICE_ACCOUNT_JSON`
- Skip obviously invalid APNs-style tokens instead of trying to send them
- Return a delivery summary from the send function:
  - attempted
  - skipped_invalid_format
  - sent
  - failed_apns_auth

2. Harden the client token registration flow
- Add a small validation guard so only FCM-looking iOS tokens are registered from JS
- Prevent old APNs hex tokens from being re-linked if they still appear in preferences

3. Clean existing bad tokens
- Add a one-time migration or backend cleanup path to remove stale APNs-format tokens from `push_device_tokens`

4. Update the manual iOS setup guide
- Add a precise checklist to verify:
  - bundle ID in Xcode
  - bundle ID in Firebase app config
  - `GoogleService-Info.plist` matches that app
  - APNs auth key uploaded for that Firebase project
  - correct Apple team/app association

5. Keep the current native setup but clarify misleading logs
- The Firebase warning at startup is likely emitted before your configure call completes; your later log `Firebase configured & delegates set` shows setup is happening
- The real blocker remains the APNs/Firebase credential rejection, not initialization timing

What you likely need to verify outside the code:
- In your Apple developer setup and Firebase setup, the same app identity must match:
```text
Xcode bundle id        = com.sashiko.app
GoogleService-Info app = same iOS app
Firebase sender setup  = same Firebase project as service account
APNs auth key          = valid, active, and uploaded to that Firebase project
```

Technical details:
- Your backend is successfully reaching FCM HTTP v1.
- FCM is rejecting delivery with `THIRD_PARTY_AUTH_ERROR` and nested `ApnsError 403 InvalidProviderToken`.
- That specific combination means the OAuth to Google is fine, but Google cannot authenticate to Apple Push Notification service for this iOS app.
- So the bug is downstream of token storage and upstream of device delivery.
- Also, the lingering native log `[PushSetup] Supabase upsert HTTP 401` suggests your local Xcode Swift file still contains old direct-upsert code from an earlier setup attempt. It is not the main blocker now, but it should be removed to avoid confusion and duplicate flows.

If you approve, I’ll implement the diagnostics/cleanup changes in code and update the manual iOS guide so the app only stores valid iOS FCM tokens and gives you clear send-failure reporting while you fix the Apple/Firebase credential mismatch.
