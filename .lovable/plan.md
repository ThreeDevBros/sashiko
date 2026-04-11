
What the latest logs show

- The backend is authenticating correctly with Firebase now.
- The push token sent from the iPhone is reaching the backend and being used.
- The failure is still happening at Apple delivery time, not at app registration time and not at Google OAuth time.

Evidence from the logs
- `OAuth2 response: token_type="Bearer"... access_token exists=true`
- `Auth header: len=1031...`
- FCM endpoint is correct for project `sashiko-asian-fusion-75c70`
- The real error is:
  - `THIRD_PARTY_AUTH_ERROR`
  - `ApnsError`
  - `reason: "InvalidProviderToken"`

What that means
- Firebase accepted your service account auth.
- Firebase then tried to hand the notification off to Apple.
- Apple rejected Firebase’s APNs credentials for this iOS app.
- So the remaining blocker is outside this codebase: Apple/Firebase app configuration mismatch.

Most likely causes now
1. The APNs auth key uploaded in Firebase belongs to a different Apple Developer team than the app.
2. The Team ID entered in Firebase does not match the team that owns the bundle ID.
3. The iOS app in Firebase is registered under a different bundle ID than the native app build.
4. The native app is using a different Firebase app/config file than the Firebase project whose server key is being used.
5. Less likely: stale Firebase Apple config needs to be removed and re-added cleanly.

Important code findings
- Native app id in this repo is `com.sashiko.app` (`capacitor.config.ts`).
- There is no iOS folder checked into this project, so I cannot verify the actual Xcode bundle id or the `GoogleService-Info.plist` currently inside your native iOS project from here.
- Broadcast sending code is using the shared FCM helper correctly; nothing in the current logs points to a bug in `send-broadcast-notification` or `fcm-v2.ts`.

Plan to resolve it
1. Verify bundle ID alignment end-to-end
- Confirm the iOS app’s Xcode bundle identifier is exactly `com.sashiko.app`.
- Confirm the Apple App ID in Apple Developer is also `com.sashiko.app`.
- Confirm the iOS app entry in Firebase is registered with the exact same bundle ID.

2. Verify Firebase iOS app config file
- In the native iOS project, confirm the installed `GoogleService-Info.plist` belongs to the same Firebase project shown in the logs:
  - project id should match `sashiko-asian-fusion-75c70`
- If there is any doubt, download a fresh plist from that Firebase iOS app entry and replace the existing one in Xcode.

3. Recreate Apple credentials in Firebase cleanly
- In Firebase Cloud Messaging, remove the current APNs auth key configuration.
- Re-upload the fresh `.p8` key.
- Re-enter the exact Key ID and Team ID from Apple Developer.
- Wait a few minutes for propagation before testing again.

4. Verify Apple-side ownership
- Make sure the `.p8` key was created in the same Apple Developer account/team that owns `com.sashiko.app`.
- Make sure Push Notifications capability is enabled for that App ID in Apple Developer.

5. If it still fails, add one final diagnostic pass in code
- In default mode I can add temporary logging to expose:
  - which Firebase project/app config the native app reports
  - whether the device is definitely connected to the same Firebase project as the backend
- This would help prove whether the mismatch is Firebase app config vs Apple auth config.

What I need from you next
- Check these three values in your native iOS project and compare them:
  1. Xcode bundle identifier
  2. Firebase iOS app bundle identifier
  3. Apple Developer App ID bundle identifier
- Also confirm the `GoogleService-Info.plist` in Xcode belongs to Firebase project `sashiko-asian-fusion-75c70`.

Technical summary
```text
Working:
iPhone FCM token -> saved in backend -> backend gets Bearer token -> FCM request sent

Failing:
FCM -> APNs handoff

Exact provider error:
THIRD_PARTY_AUTH_ERROR / InvalidProviderToken

Conclusion:
This is no longer a backend auth/code problem.
It is an Apple credentials or Firebase iOS app configuration mismatch.
```

If you want, the next implementation step after this verification is for me to add a small native/web diagnostic surface so we can confirm the active Firebase app/project and eliminate plist/bundle mismatches with certainty.
