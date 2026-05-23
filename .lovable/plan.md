## Problem

The log shows Android native Google Sign-In reaches Google Play Services, then fails before token exchange:

- Google Play Services reports `NETWORK_ERROR`
- Capacitor plugin returns `code: "7"` and message `Something went wrong`
- Google’s official status code docs define `7` as `NETWORK_ERROR`

So the app is not failing in the backend token exchange. The Android native Google sign-in plugin is failing inside Google Play Services, likely because the emulator/device Play Services network stack cannot obtain the OAuth token, or because the local native OAuth setup needs a more explicit Android/server client configuration.

## Plan

1. **Preserve the real Android error code**
   - Update `src/lib/nativeGoogleSignIn.ts` so errors returned from the Android plugin keep their `code`, `message`, and raw details.
   - Replace `[object Object]` logging with structured logs that show the actual code/message in logcat.

2. **Improve the on-screen error message**
   - Update `src/pages/Auth.tsx` so Google error `code: 7` shows a specific message like:
     - `Google sign-in could not connect through Google Play Services. Check internet, update Play Services, or try a physical device.`
   - Keep cancellation silent.
   - Keep normal email/password auth messages unchanged.

3. **Harden Android GoogleAuth config**
   - Update the Android Google sign-in initialization to pass both the Android/web client values the plugin expects, instead of only `clientId`.
   - Keep `server_client_id` in `strings.xml` as fallback.
   - Set the plugin’s optional Play Services Auth version in `android/variables.gradle` so dependency resolution is explicit and aligned with the plugin docs.

4. **Add a safe fallback path for Android native only**
   - If native Android Google Sign-In fails with code `7`, optionally fall back to the managed browser OAuth flow inside the native app, so users still have a way to sign in when Google Play Services fails.
   - Use the app’s existing deep-link OAuth callback configuration.

## Files to change

- `src/lib/nativeGoogleSignIn.ts`
- `src/pages/Auth.tsx`
- `android/variables.gradle`

## Validation

- Confirm code `7` is mapped correctly and no longer appears as only `Something went wrong`.
- Confirm logcat prints the actual native GoogleAuth error details.
- Confirm email/password and Apple sign-in error handling are not regressed.
- After implementation, Android needs a fresh native sync/rebuild for native Gradle changes to apply.