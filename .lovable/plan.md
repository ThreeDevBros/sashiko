
Problem found

The app-wide resume fix is still incomplete because only `/order-tracking` follows the full native reopen pattern.

What `/order-tracking` does right:
- waits for `isAuthReady && !isAuthRecovering`
- reloads its own data on `subscribeToResume(...)`
- uses a fresh `supabase.auth.getSession()` before protected reads
- reconnects realtime with a `resumeCounter`

What the rest of the app does wrong:
- the root app refreshes auth and invalidates React Query, but many screens do not use React Query for protected data
- several customer flows still run one-off `useEffect` fetches with `auth.getUser()` or `getSession()` and no resume retry
- those effects can run during native session restoration, see “no user”, set empty state, and never rerun

That explains why:
- `/order-tracking` recovers
- home banners, reservations, addresses, and other pages go empty after reopen
- navigating later still feels broken because the earlier empty state was never repaired

Fix plan

1. Make app resume behave like a mini re-bootstrap
- In `src/App.tsx`, treat native/web resume as a temporary recovery phase
- keep showing the loading gate while `refreshSession()` is running
- after a successful resume refresh, invalidate queries and remount the routed app tree so one-shot page effects run again with a restored session

2. Expose a global “resume/auth generation” from auth state
- In `src/contexts/AuthContext.tsx`, add a counter/version that increments after initial restore and after every successful resume refresh
- use that version in the root app to force remount of pages after reopen
- this applies the `/order-tracking` recovery behavior to the whole app, not just one page

3. Replace fragile auth reads in customer-facing screens
Update the hot paths that currently break on reopen so they wait for auth recovery to finish and use a fresh session:
- `src/components/ActiveReservationBanner.tsx`
- `src/pages/ReservationHistory.tsx`
- `src/components/checkout/AddressSelector.tsx`
- `src/hooks/useDeliveryValidation.ts`
- `src/hooks/useSavedCards.ts`
- `src/pages/Auth.tsx`

For these:
- stop using `auth.getUser()` as the first gate during reopen
- use `isAuthReady`, `isAuthRecovering`, and a fresh `auth.getSession()` / context user
- rerun their load logic when the new auth-resume version changes

4. Keep the already-working pattern as the standard
- Leave `src/pages/OrderTracking.tsx` as the reference implementation
- keep `subscribeToResume` for screens that own imperative/realtime data
- use the new root remount/auth-version pattern so pages without custom resume code still recover correctly

5. Do a final pass on the homepage + menu path
- verify `Index`, `ActiveOrderBanner`, `useBranch`, and `MenuDisplay` all re-evaluate correctly after the root remount
- ensure current order banner, branch data, and menu queries all refetch after reopen instead of staying on stale empty state

Files to modify
- `src/App.tsx`
- `src/contexts/AuthContext.tsx`
- `src/components/ActiveReservationBanner.tsx`
- `src/pages/ReservationHistory.tsx`
- `src/components/checkout/AddressSelector.tsx`
- `src/hooks/useDeliveryValidation.ts`
- `src/hooks/useSavedCards.ts`
- `src/pages/Auth.tsx`

Technical details

```text
Current behavior:
resume -> refresh auth -> invalidate queries
but mounted pages keep their old local empty state

Planned behavior:
resume -> set auth recovering -> refresh auth -> bump auth version
       -> invalidate queries -> remount app tree
       -> all pages rerun after session is safely restored
```

This is the closest app-wide equivalent to the logic that already works in `/order-tracking`, and it fixes the real gap: root invalidation alone cannot recover pages that fetch protected data imperatively and never retry.
