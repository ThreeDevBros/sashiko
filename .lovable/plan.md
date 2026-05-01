## Context

Web Apple Sign In started working after you reduced Apple's registered Return URLs to just `https://oauth.lovable.app/callback`. Now native iOS Apple Sign In is broken.

## Why this can happen

The native iOS flow does NOT use the OAuth broker / Return URLs at all. It:

1. Calls the native `SignInWithApple` Capacitor plugin → Apple returns an `identityToken` JWT.
2. Calls `supabase.auth.signInWithIdToken({ provider: 'apple', token })` → Supabase validates the JWT.

The validation that matters is the JWT's `aud` (audience) claim. Our native call sends `clientId: 'app.lovable.6e0c6b4d4b7943e7a8431d08565d9c10'`, so Apple issues a token with `aud = app.lovable.6e0c6b4d4b7943e7a8431d08565d9c10`. Supabase's Apple provider must accept that audience.

Two plausible regressions:

- **A.** While editing Apple Developer to remove Return URLs, the **Services ID** `app.lovable.6e0c6b4d4b7943e7a8431d08565d9c10` was deleted, renamed, or had Sign In with Apple disabled. → native plugin call fails or returns a token whose `aud` no longer matches.
- **B.** The Services ID is fine, but Lovable Cloud's managed Apple provider config no longer has it whitelisted as an additional client ID, so `signInWithIdToken` rejects with "invalid audience" / "Unverified token".

The current code shows a generic toast (`"Failed to sign in with Apple. Please try again."`) and discards the real error, so we can't tell which case it is.

## Plan

### Step 1 — Surface the real error (5 min)

Edit `src/pages/Auth.tsx` `handleAppleSignIn` to log the full error and include its message in the toast. Edit `src/lib/nativeAppleSignIn.ts` to add `console.log` lines for:

- `[AppleNative] plugin available?`
- `[AppleNative] authorize result` (without the token itself, just whether identityToken exists + decoded `aud` and `iss` claims)
- `[AppleNative] supabase signInWithIdToken error` (full error object)

### Step 2 — User retries on iOS device

You attempt Apple Sign In again on the iOS app. The console logs will be captured in the next message and tell us exactly which step fails and why.

### Step 3 — Fix based on what we learn

- If `authorize` fails or returns no token → Apple Developer side. Most likely the Services ID `app.lovable.6e0c6b4d4b7943e7a8431d08565d9c10` was inadvertently changed when you trimmed the Return URLs. Fix: confirm in Apple Developer that this Services ID still exists, has Sign In with Apple enabled, and is associated with the correct App ID / primary App ID. The Bundle ID `com.sashiko.app` must also still have the Sign In with Apple capability.
- If `authorize` succeeds but `signInWithIdToken` errors with "invalid audience" / "Unverified ID token" → Lovable Cloud Apple provider side. Fix: in Cloud → Users → Auth Settings → Sign In Methods → Apple, ensure the Services ID `app.lovable.6e0c6b4d4b7943e7a8431d08565d9c10` is registered as an accepted Client ID (or, if you switched to BYOC for the web fix, that the BYOC Client ID matches the one we send here).
- If `signInWithIdToken` errors with something else (e.g. nonce required) → adjust the call accordingly.

### Step 4 — Save a memory rule

Add a project memory: "iOS Apple Sign In uses Supabase `signInWithIdToken` directly with `clientId = app.lovable.6e0c6b4d4b7943e7a8431d08565d9c10`. Do not delete or rename that Services ID in Apple Developer, and keep it whitelisted in Lovable Cloud's Apple provider audience list."

## Files to change in Step 1

- `src/pages/Auth.tsx` — log + show real error in toast
- `src/lib/nativeAppleSignIn.ts` — add diagnostic console.log calls (decode JWT header/payload locally, no secrets exposed)

No database, no native rebuild required — pure JS, hot-reloads.

## After approval

I will apply the Step 1 logging changes, then ask you to try Apple Sign In on the iOS device once. Logs will be in your next message and I'll fix from there.