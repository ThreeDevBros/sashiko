<final-text>1. Root cause summary
- This is not one broken page or one bad API key. The app has a systemic resilience problem.
- Backend/auth requests are timing out, and many screens still use blocking page-level loaders (`loading = true`) that only clear after live network calls finish.
- Several pages call `supabase.auth.getSession()` / `getUser()` directly instead of relying on the restored auth context, so web/iOS/Android all hit the same auth-race + timeout failure mode.
- Public keys for Maps/Stripe are fetched at runtime through a backend function, so when backend requests are slow, Maps/payment look “broken” even if the keys are valid.
- The route tree is also being remounted after auth refreshes, which re-triggers page fetches and causes the loading experience to loop again.

2. What I would change
- Make startup and navigation fully non-blocking:
  - keep the app shell visible after initial bootstrap
  - stop pages from showing full-screen infinite loaders for normal data fetches
  - replace blocking loaders with inline skeletons / empty states / retry UI
- Make auth-safe data fetching:
  - use `useAuth()` as the source of truth
  - only run authenticated queries when `isAuthReady` is true
  - remove direct `getSession()/getUser()` calls from normal page-load paths where possible
- Add request resilience:
  - shared timeout wrapper for profile/roles/orders/reservations/address fetches
  - fail soft with cached data or empty state instead of hanging
  - keep retries limited and explicit
- Reduce unnecessary remounts:
  - review `authVersion` remount behavior in `App.tsx`
  - avoid reloading the whole route tree on token refresh unless absolutely necessary
  - stop invalidating every query on every resume if session did not materially change
- Decouple public key availability from backend instability:
  - centralize publishable key loading
  - cache keys in memory/localStorage after first success
  - reuse one loader for web + native payment/maps flows
- Standardize page patterns:
  - no page should remain at `loading=true` forever
  - auth-required pages should either render guest fallback, redirect, or show an error/retry state

3. Files to update
- Core app/auth:
  - `src/App.tsx`
  - `src/contexts/AuthContext.tsx`
  - `src/lib/lifecycleManager.ts`
- Shared data/auth hooks:
  - `src/hooks/useAdmin.ts`
  - `src/hooks/usePermissions.ts`
  - `src/hooks/useRoleRedirect.ts`
  - `src/hooks/useSavedCards.ts`
  - add one shared resilient query/fetch helper
- Blocking pages to refactor first:
  - `src/pages/Profile.tsx`
  - `src/pages/Address.tsx`
  - `src/pages/OrderHistory.tsx`
  - `src/pages/ReservationHistory.tsx`
  - `src/pages/OrderTracking.tsx`
  - `src/pages/DriverDashboard.tsx`
  - `src/pages/driver/DriverOrders.tsx`
  - `src/pages/driver/DriverActiveDelivery.tsx`
  - `src/pages/CheckoutSuccess.tsx`
- Public key / integration loading:
  - `src/lib/googleMaps.ts`
  - `src/components/checkout/AddressSelector.tsx`
  - `src/components/checkout/GuestCardPayment.tsx`
  - `src/pages/Checkout.tsx`
  - `src/lib/nativeStripePay.ts`

4. Implementation order
- Step 1: fix auth/remount behavior in the app shell
- Step 2: introduce resilient shared fetch/auth utilities
- Step 3: refactor the blocking pages listed above
- Step 4: centralize and cache public Maps/Stripe key loading
- Step 5: verify on preview + published web + native resume/login/navigation flows

5. Expected result
- Web, iOS, and Android all stop getting trapped behind loaders when backend/auth is slow
- Pages render immediately with partial UI, cached data, or graceful fallback states
- Maps/payment stop appearing randomly broken because public key loading becomes resilient
- Resume/backgrounding no longer causes the app to remount and re-break the current page

6. Technical details
- Highest-risk anti-patterns currently present:
  - page components starting with `loading=true` and awaiting raw Supabase calls
  - direct `getSession()` / `getUser()` during page startup
  - route-wide remounting after auth refresh
  - runtime backend fetch for public keys in multiple places
- The deepest fixes are architectural, not cosmetic; patching one page at a time without fixing auth/data flow will keep reproducing the issue across platforms.

7. After approval
- I’ll implement the refactor, then test the main flows end-to-end on preview and published web, and verify the same startup/navigation/resume behavior for native-compatible flows.</final-text>