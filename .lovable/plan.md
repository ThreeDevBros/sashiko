
Goal: fix the persistent native iOS Google sign-in failure by handling nonce correctly instead of trying to clear auth state after the fact.

What I found
- The Google native flow is now working up to account selection and token return.
- The failure happens only at `supabase.auth.signInWithIdToken(...)`.
- The key error is: `Passed nonce and nonce in id_token should either both exist or not.`
- The iOS system logs (`usermanagerd`, `runningboard`, resume events) are noise here, not the root cause.

Root cause
- `setup/swift/GoogleAuthPlugin.swift` calls Google sign-in without supplying a controlled nonce.
- Modern Google iOS sign-in can return an ID token containing a nonce claim.
- `src/lib/nativeGoogleSignIn.ts` sends the ID token to `signInWithIdToken` without the matching raw nonce.
- Clearing local storage and calling local sign-out cannot fix this, because the nonce is inside the returned Google token itself.

Planned fix
1. Update the native Google plugin to support nonce input
- Change `GoogleAuthPlugin.signIn()` to accept a nonce value from JS.
- Use the Google iOS sign-in API overload that supports passing a nonce.
- Return the normal auth payload plus lightweight debug metadata if needed.

2. Generate a proper nonce pair in JS
- In `src/lib/nativeGoogleSignIn.ts`, generate:
  - `rawNonce`
  - `nonceDigest = sha256(rawNonce)` as lowercase hex
- Pass `nonceDigest` into the native Google plugin.
- Keep `rawNonce` in JS only.

3. Exchange the token with the matching raw nonce
- Call:
  - `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken, nonce: rawNonce })`
- Remove the current workaround logic that signs out locally and clears storage keys before exchange, since it is masking the real issue and causes the extra `SIGNED_OUT` churn in logs.

4. Add safe diagnostics
- Log only whether the returned JWT payload contains a nonce claim, not the token itself.
- Log whether a raw nonce was generated and whether a digest was sent to native.
- This makes future failures obvious without exposing secrets.

5. Align native setup docs
- Update `setup/SETUP.md` to require a GoogleSignIn iOS version that supports custom nonce cleanly.
- Document that after repo changes the copied native plugin file in Xcode must be replaced again.
- Keep `SERVER_CLIENT_ID` sourced from the plist so `capacitor.config.ts` does not need repeated edits.

Files to update
- `src/lib/nativeGoogleSignIn.ts`
- `setup/swift/GoogleAuthPlugin.swift`
- `setup/SETUP.md`
- Possibly `capacitor.config.ts` only for cleanup/removing the placeholder confusion, not as the core fix

Technical details
```text
JS
  rawNonce -------------------------------> signInWithIdToken(... nonce: rawNonce)
  sha256(rawNonce) -> nonceDigest --------> native Google sign-in

Native Google SDK
  signIn(nonce: nonceDigest)
      -> Google returns id_token with nonce claim = nonceDigest

Backend validation
  sha256(rawNonce) == id_token.nonce
  -> session accepted
```

Important note
- If the current installed Google iOS pod does not expose the nonce-capable API cleanly, I will also update the setup instructions to move to the newer supported GoogleSignIn version before rebuilding.
- As a fallback only, I can also plan a backend auth-setting change for iOS nonce skipping, but the primary fix should be the proper nonce flow above.

Validation after implementation
- Native Google prompt opens
- Account can be selected
- No `SIGNED_OUT` event before token exchange
- `signInWithIdToken` returns session/user
- Auth listener reports `SIGNED_IN`
- Session survives resume as before
