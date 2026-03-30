

# Fix Native App Web Redirects

## Problem
Several functions redirect the native iOS app to external web pages (Supabase OAuth, external URLs), breaking the native experience. The main offenders:

1. **Google Sign In** (`Auth.tsx`) — uses `supabase.auth.signInWithOAuth` which opens a web browser for OAuth flow
2. **Apple Sign In fallback** (`nativeAppleSignIn.ts`) — already fixed for iOS, but the non-iOS fallback still uses web OAuth
3. **Password Reset** (`Auth.tsx`) — `resetPasswordForEmail` sends an email with a link that opens in a web browser (acceptable behavior)
4. **`window.open` calls** for Google Maps directions and phone calls — these are intentional and fine on native (they open Maps app / Phone app)

## What Needs Fixing

### 1. Google Sign In — Native Implementation (Critical)
**Current**: `supabase.auth.signInWithOAuth({ provider: 'google' })` opens Safari/web browser on iOS.

**Fix**: Create `src/lib/nativeGoogleSignIn.ts` similar to `nativeAppleSignIn.ts`:
- On iOS/Android: Use `@codetrix-studio/capacitor-google-auth` plugin for native Google Sign In
- Calls `GoogleAuth.signIn()` to get the ID token natively
- Exchanges the token with Supabase via `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })`
- Falls back to web OAuth on non-native platforms

**Update `Auth.tsx`**: Replace `handleGoogleSignIn` to call the new native function.

### 2. Install Capacitor Google Auth Plugin
- Add `@codetrix-studio/capacitor-google-auth` dependency
- Requires a Google OAuth Client ID (iOS type) configured in the Google Cloud Console

### 3. Manual Steps Required (by you)
- Create an **iOS OAuth Client ID** in Google Cloud Console (type: iOS, bundle ID: `com.sashiko.app`)
- The `clientId` from this will be used in the plugin configuration
- Add the reversed client ID as a URL scheme in Xcode (`Info.plist`)

## Files to Create/Edit

| File | Change |
|------|--------|
| `src/lib/nativeGoogleSignIn.ts` | New file — native Google Sign In with Capacitor plugin, fallback to web OAuth |
| `src/pages/Auth.tsx` | Update `handleGoogleSignIn` to use native function |
| `capacitor.config.ts` | Add Google Auth plugin configuration |
| `package.json` | Add `@codetrix-studio/capacitor-google-auth` dependency |

## Not Changing (Intentional Behavior)
- `window.open` for Google Maps links — opens native Maps app
- `window.open` for `tel:` links — opens native Phone app
- Password reset email links — expected to open in browser
- `window.location.assign('/')` in ErrorBoundary — navigates within the app

