
Deep investigation result

Do I know what the issue is? Yes.

This is not mainly a backend or token-refresh failure anymore. The evidence points to a client-side lifecycle race:

- Resume is firing: console shows `Visibility resume fired`
- Auth is refreshing: console shows `TOKEN_REFRESHED has session` and `SIGNED_IN has session`
- Core public data can recover: `useBranch` resolves the branch successfully after resume
- Auth logs also show successful `/token` refreshes and `/user` 200 responses

So the real problem is:

1. The root app still keeps the normal UI mounted while auth recovery is happening  
   In `src/App.tsx`, once `bootstrapComplete` becomes true, the app tree stays rendered even during later `isAuthRecovering` windows. That means screens can keep running effects during native reopen/cold restore.

2. Most of the app still uses fragile one-shot auth reads  
   Many customer flows still do `supabase.auth.getUser()` or single `getSession()` calls, then early-return / set empty state / redirect if no user is present at that exact moment. After native reopen or kill+restore, that moment is often too early.

3. Those loaders usually do not retry on resume  
   `/order-tracking` works because it does all 3 things correctly:
   - waits for `isAuthReady && !isAuthRecovering`
   - reloads on `subscribeToResume(...)`
   - uses a fresh session before protected reads
   - reconnects realtime using `resumeCounter`

Why the rest of the app breaks

The rest of the app is only partially using that pattern, so after reopen it can enter a “half-restored” state:
- auth is valid again
- but some screens already concluded “no user”
- some queries cached empty results
- some pages redirected or stayed empty
- some dialogs/pages loaded once and never retried

Concrete weak spots found

Customer-facing files still vulnerable to this pattern:
- `src/pages/Address.tsx` — checks session once, redirects to `/auth` if it misses restore timing
- `src/pages/Checkout.tsx` — payment-intent init still uses `getUser()` and can early-return
- `src/components/checkout/CheckoutForm.tsx` — several `getUser()`-based flows
- `src/components/checkout/AddressSelector.tsx` — loads once, can end up empty and stay empty
- `src/components/DeliveryLocationSelector.tsx` — loads on open only, no resume-aware rerun
- `src/hooks/useSavedCards.ts` — returns `[]` when session is temporarily unavailable, which can cache a false empty state
- `src/hooks/useDeliveryValidation.ts` — runs protected logic without auth lifecycle gating
- `src/components/booking/BookingDialog.tsx` — prefill uses `getUser()` once on open
- `src/hooks/useRoleRedirect.ts` and parts of `src/pages/Auth.tsx` — still do their own auth probing outside the main auth lifecycle

Root cause in one sentence

`/order-tracking` works because it is fully resume-aware; the rest of the app is still a mix of old one-shot auth loaders and newer recovery logic, so native iOS reopen/kill restore leaves the app in inconsistent local state.

Plan to fix it

1. Rebuild the root recovery gate in `src/App.tsx`
- Make the routed app tree pause/unmount during every auth recovery, not only during first bootstrap
- Re-enter the loading gate on native reopen/cold restore
- Only re-show routes after session recovery is fully settled
- Then invalidate queries and remount routes

2. Standardize one app-wide “auth is safe to query now” rule
- Use `isAuthReady && !isAuthRecovering && !!user` as the only allowed condition for protected reads
- Stop letting individual screens guess auth readiness for themselves
- Add a small shared helper/hook for this so the pattern is reused consistently

3. Replace resume-fragile `getUser()` usage in customer flows
- Swap `getUser()` for context user or a fresh `getSession()` only after auth is settled
- Ensure protected loaders rerun when `authVersion` changes
- Fix the critical customer path first:
  - home banners/current order
  - address page
  - checkout
  - saved cards
  - booking dialog

4. Make non-React-Query loaders resume-aware like `/order-tracking`
For imperative/local-state loaders:
- rerun on `authVersion`
- or subscribe to `subscribeToResume(...)` when they own important state
- never permanently set empty state from a transient “no user yet” result

5. Fix false-empty React Query caches
- Gate authenticated queries with `enabled`
- include `user?.id` / `authVersion` in query keys where needed
- avoid returning `[]` during recovery and treating it as real data

6. Clean up auth-driven redirects
- Prevent `/auth` redirects during restore windows
- Make role redirect / auth page rely on the shared auth context instead of separate probing

Files to update

Primary:
- `src/App.tsx`
- `src/contexts/AuthContext.tsx`

Customer-critical audit:
- `src/pages/Address.tsx`
- `src/pages/Checkout.tsx`
- `src/components/checkout/CheckoutForm.tsx`
- `src/components/checkout/AddressSelector.tsx`
- `src/components/DeliveryLocationSelector.tsx`
- `src/hooks/useSavedCards.ts`
- `src/hooks/useDeliveryValidation.ts`
- `src/components/booking/BookingDialog.tsx`
- `src/components/ActiveOrderBanner.tsx`
- `src/components/ActiveReservationBanner.tsx`
- `src/pages/Auth.tsx`
- `src/hooks/useRoleRedirect.ts`

Technical detail

```text
Current:
resume -> refresh token succeeds
       -> app UI stays mounted during recovery
       -> some screens run getUser/getSession too early
       -> they store empty/redirect state
       -> no retry
       -> app looks broken

Target:
resume -> app enters global recovery gate
       -> session fully restored
       -> queries invalidated + routes remounted
       -> protected loaders run only after auth is settled
       -> imperative screens rerun on authVersion / resume
       -> app recovers consistently like /order-tracking
```

This should solve both cases the user described:
- close and reopen from background
- kill and reopen on native iOS
