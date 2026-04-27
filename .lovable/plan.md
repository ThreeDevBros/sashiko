## Goal
Set up Apple Sign-In on Android using the Lovable Cloud web OAuth flow (already supported), keep iOS native Apple Sign-In untouched, and harden the Android in-app flow so the WebView returns cleanly with tokens.

## Current state (good news)
- iOS: native `SignInWithApple` plugin → `supabase.auth.signInWithIdToken`. Working, do not touch.
- Android & Web: `nativeAppleSignIn` already falls back to `lovable.auth.signInWithOAuth('apple', { redirect_uri: window.location.origin })`. The Lovable OAuth broker handles the Apple flow and returns tokens to the WebView; `setSession` is then called automatically inside the lovable client.

So functionally, Apple login on Android already works via the in-app WebView flow. The remaining work is to make sure the redirect actually lands back inside the Android app (instead of opening Apple in an external browser and getting stuck).

## What needs to change

### 1. `src/lib/nativeAppleSignIn.ts`
Make the Android branch explicit so future readers (and Capacitor's WebView) know it MUST stay in-app:
- Detect `Capacitor.getPlatform() === 'android'` separately from web.
- For Android: pass a `redirect_uri` of `https://sashikoasianfusion.com` (the registered production domain) instead of `window.location.origin` (which is `http://localhost` on Capacitor Android and not registered with Apple). Lovable's broker accepts this and posts tokens back via the OAuth callback intercepted by the WebView.
- Keep web behavior identical (uses `window.location.origin`).
- iOS branch: unchanged.

### 2. `android/app/src/main/AndroidManifest.xml`
Add an intent-filter so the OAuth callback URL (`https://sashikoasianfusion.com/~oauth/callback` and `com.sashiko.app://auth/callback`) is captured by MainActivity if Apple ever opens an external browser. This is a safety net — the in-WebView flow normally handles it directly.

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="sashikoasianfusion.com" android:pathPrefix="/~oauth" />
</intent-filter>

<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="com.sashiko.app" android:host="auth" />
</intent-filter>
```

### 3. Apple Developer Console (manual, user action — one-time)
Confirm these are configured in the Apple Services ID used by Lovable Cloud's managed Apple provider:
- Authorized domain: `sashikoasianfusion.com` (and `*.lovable.app`)
- Return URL: the Lovable OAuth broker callback (already configured by the managed provider — no action needed unless using BYOC credentials)

Since the project uses Lovable Cloud's **managed** Apple provider, the Apple Developer setup is already handled by Lovable. No manual Apple Console work required.

## Files to edit
- `src/lib/nativeAppleSignIn.ts` — explicit Android branch with correct `redirect_uri`
- `android/app/src/main/AndroidManifest.xml` — add OAuth callback intent-filters as a safety net

## After changes (user steps)
```bash
git pull && npx cap sync android && npm run cap:android
```

## Result
- iOS: native Apple sign-in popup (unchanged)
- Android: tap "Sign in with Apple" → Apple login page opens inside the app's WebView → user authenticates → tokens returned → session set → user logged in
- Web: unchanged (Lovable Cloud OAuth)