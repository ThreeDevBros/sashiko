
What the latest evidence says

- Yes, I can now tell where the issue is much more clearly.
- The failure is no longer on the iPhone side for token capture/storage.
- The failure is also no longer on the Google OAuth token exchange step.

What is working
- iOS app gets an FCM token:
  - your native log shows `[PushSetup] FCM token: fe0JfpN8...`
- Web layer reads that token:
  - `[Push] FCM token from Preferences: fe0JfpN8...`
- Backend stores it successfully:
  - `[Push] Token saved to database (guest)`
  - `[Push] Token saved to database (authenticated)`
- Backend gets an OAuth access token successfully:
  - edge logs show `[FCM] OAuth2 token obtained successfully, expires_in: 3599s`

What is failing
- The actual request from the backend to Firebase Cloud Messaging fails for every token:
  - `401 Request is missing required authentication credential`
- This happens after the helper says it has an access token, which means the bug is in how the shared FCM sender is constructing or using that token during the final `fetch()` to FCM.

Why this points to the shared backend helper
- The same shared file `supabase/functions/_shared/fcm-v2.ts` is used by:
  - `send-broadcast-notification`
  - `send-order-push`
- In that helper:
  - it successfully creates a JWT
  - successfully exchanges it for an OAuth token
  - then calls `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`
  - but Google still says the request has no valid auth credential
- That narrows it to one of these backend-side causes:
  1. the returned OAuth response is not being validated enough before use
  2. the Authorization header value is malformed at send time
  3. the token response shape is unexpected and `data.access_token` is not what we think
  4. less likely: the function instance is using stale code/secret state and needs a clean redeploy of all functions that import the shared helper

What is not the blocker right now
- Not device registration
- Not guest/auth linking
- Not the iOS logs you pasted
- Not APNs token vs FCM token confusion anymore
- Not invalid token format filtering

Recommended next implementation
1. Harden the shared FCM helper
- Add strict validation after token exchange:
  - verify `token_type === "Bearer"`
  - verify `access_token` exists and is non-empty
  - log safe metadata only: token_type, expires_in, access token length/prefix
- Build the Authorization header from a trimmed token value.
- Log the exact FCM request metadata before send:
  - project id
  - whether auth header is present
  - token length/prefix
  - endpoint being called
- Log the full FCM error body, not the truncated 200-char slice.

2. Redeploy every function that imports the shared helper
- Redeploy:
  - `send-broadcast-notification`
  - `send-order-push`
- This matters because the shared `_shared/fcm-v2.ts` change needs all importing functions refreshed.

3. Run a fresh broadcast test and inspect new logs
- We should confirm whether the access token is:
  - missing
  - empty
  - wrong token type
  - malformed at header construction
- If Firebase then returns a different error such as sender/project mismatch or APNs config issues, that will be the real next blocker.

4. Optional fallback if the HTTP v2 helper still behaves oddly
- Replace the manual JWT/OAuth implementation with Google-auth library based signing inside the function, or a known-good fetch pattern with URLSearchParams/body encoding and stricter response parsing.
- Only do this if the improved diagnostics still show an inexplicable 401 despite a valid bearer token.

Expected outcome
- Most likely outcome: the new diagnostics will expose that the token being passed to `Authorization: Bearer ...` is empty/malformed or not the actual access token string.
- Second most likely outcome: after redeploying both functions, the 401 changes to a more specific Firebase/APNs error, which means auth was fixed and we can then solve the next real provider configuration issue.

Technical details
```text
Current chain:
iPhone -> valid FCM token -> DB saved -> edge function -> OAuth token OK -> FCM send 401

So the break is here:
OAuth token received
   |
   v
Authorization header / final FCM request
   |
   v
FCM rejects request with 401
```

Files involved
- `supabase/functions/_shared/fcm-v2.ts`
- `supabase/functions/send-broadcast-notification/index.ts`
- `supabase/functions/send-order-push/index.ts`

If approved, I’ll implement the diagnostics hardening in the shared helper, redeploy both push-related backend functions, and use the new logs to identify the exact final auth failure.
