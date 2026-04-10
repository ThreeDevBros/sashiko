

## Fix Push Notifications — End-to-End

There are **five distinct bugs** preventing push notifications from working. All must be fixed together.

### What's Wrong

1. **Registration loop** — The `usePushNotifications` hook depends on `[navigate]` in its `useEffect`. React Router's `useNavigate()` returns a new reference on every route change, which tears down and re-registers push listeners repeatedly (visible in the logs as dozens of `requestPermissions`/`register` calls). This also means `removeAllListeners()` runs before the `registration` callback fires, so **tokens are never captured**.

2. **Tokens never saved to database** — The `push_device_tokens` table has **0 rows**. Because of the loop above, the `registration` event listener gets removed before the native side delivers the token to JS.

3. **Guest tokens can't be stored** — `push_device_tokens.user_id` is `NOT NULL`, so even if the listener worked, guest device tokens cannot be inserted.

4. **Edge function auth broken** — `send-broadcast-notification` calls `authClient.auth.getClaims(token)` which **does not exist** in supabase-js v2. This causes a 401 every time.

5. **Broadcast misses guest devices** — The edge function queries tokens only for users found in `profiles`. Guest devices (null `user_id`) are never included.

### Fixes

**1. Fix `usePushNotifications.ts` — stop the registration loop**
- Wrap `navigate` in a stable `useRef` so the `useEffect` has **no dependencies** and runs exactly once.
- Move `attachListeners()` call **before** `PushNotifications.register()` (already correct, but ensure cleanup doesn't race).
- Remove `navigate` from the dependency array.

**2. Database migration — allow guest device tokens**
```sql
ALTER TABLE public.push_device_tokens ALTER COLUMN user_id DROP NOT NULL;
DROP INDEX IF EXISTS push_device_tokens_user_id_token_key;
CREATE UNIQUE INDEX push_device_tokens_token_key ON public.push_device_tokens(token);
```
Also add an RLS policy so the service role (used by edge functions) can read all tokens, and guest devices can insert without auth:
```sql
CREATE POLICY "Anyone can insert device tokens"
  ON public.push_device_tokens FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
```

**3. Update `usePushNotifications.ts` — save guest tokens to DB**
- When no user is authenticated, insert the token with `user_id = null` directly into the database (using the anon role, permitted by the new RLS policy).
- On `SIGNED_IN`, update existing token rows to set the `user_id`.

**4. Fix `send-broadcast-notification/index.ts` — replace `getClaims`**
- Replace `authClient.auth.getClaims(token)` with `supabase.auth.getUser(token)` using the service role client.
- Extract `userId` from the returned user object.

**5. Update broadcast function — include guest devices**
- After querying tokens for profile-based `userIds`, also query tokens where `user_id IS NULL`.
- Merge both sets before sending via FCM.

### Files Changed
- `src/hooks/usePushNotifications.ts` — stabilize effect, save guest tokens to DB
- `supabase/functions/send-broadcast-notification/index.ts` — fix auth, include guest tokens
- New migration — make `user_id` nullable, update unique constraint, add RLS policy

### Summary of Log Warnings (Not Bugs)
- `FirebaseCore` "not yet configured" — harmless timing log before `AppDelegate` runs
- `UIScene lifecycle` — iOS deprecation warning, no action needed
- AutoLayout constraint conflicts — iOS system UI, not from app code
- `RTIInputSystemClient` / `Reporter disconnected` — iOS keyboard internals, harmless

