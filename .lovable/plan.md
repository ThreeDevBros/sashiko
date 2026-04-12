
Goal

Fix the real native iOS reopen/restart problem end-to-end: no unexpected logout, no broken tracking after reopen, no stale realtime/live updates, and no screens stuck in loading because auth/data recovery raced.

What I checked

- The app already has a top-level bootstrap gate in `App.tsx`, so this is not just “render too early”.
- The remaining gaps are deeper:
  1. `AuthContext.tsx` still relies on web storage only. There is no native backup/restore path for the session.
  2. `OrderTracking.tsx` refreshes auth on resume, but `loadOrderDetails()` still uses the stale `user` value from the old render, so it can take the wrong guest/auth path right after reopen.
  3. Only some realtime subscriptions were hardened. Others still use static channel names and no resume reconnect, especially driver/location tracking paths.
  4. Protected-route logic can still react to a temporary “no user yet” state during recovery.
  5. Some hot paths still make direct auth-dependent calls without a shared “auth recovered” guard.

Plan

1. Harden native auth persistence and recovery
- Update `src/contexts/AuthContext.tsx` to:
  - mirror the current session into native persistent storage on mobile
  - restore that stored session on cold reopen before declaring auth ready
  - clear native stored session on sign-out
  - add a recovery/refresh-in-progress flag so the rest of the app can wait properly
  - make refresh a single-flight operation so multiple resume events do not race

2. Prevent false logout / bad redirects during recovery
- Update `src/App.tsx` route protection to wait for auth recovery, not just basic auth readiness.
- Update any auth redirect logic that can fire too early, especially `src/pages/Auth.tsx`.

3. Fix order tracking resume logic properly
- Refactor `src/pages/OrderTracking.tsx` so `loadOrderDetails()` uses a freshly resolved session/user instead of the stale closure value.
- On resume:
  - await auth recovery
  - fetch order data with the correct auth state
  - reconnect subscriptions
  - refresh Live Activity from the same fetched data
- Add an explicit error/empty-retry state so this page cannot sit in a misleading loading state forever.

4. Reconnect all critical realtime paths after reopen
- Audit and harden the still-fragile subscriptions by giving them resume-aware unique channel names and immediate re-fetch on resume:
  - `src/components/order/OrderTrackingMap.tsx`
  - `src/components/delivery/LiveDeliveryMap.tsx`
  - `src/components/ActiveOrderBanner.tsx`
  - `src/pages/driver/DriverOrders.tsx`
  - `src/components/driver/GlobalDriverTracker.tsx`
- This is especially important for driver location/live tracking, which is currently one of the most likely reasons “tracking stops”.

5. Standardize auth-dependent fetching
- Replace ad-hoc auth reads in critical screens/hooks with a shared pattern that waits for recovered auth before querying.
- Prioritize the flows users hit after reopening:
  - order tracking
  - active order banner
  - driver tracking
  - saved cards / protected views as needed

6. Add defensive error handling and diagnostics
- Ensure failed auth refresh, failed order fetches, and failed realtime re-subscribe paths surface a controlled UI state instead of silent failure.
- Keep targeted logs around resume/auth restore/reconnect so the remaining issue, if any, is obvious.

Files I expect to touch

- `src/contexts/AuthContext.tsx`
- `src/App.tsx`
- `src/pages/Auth.tsx`
- `src/pages/OrderTracking.tsx`
- `src/components/order/OrderTrackingMap.tsx`
- `src/components/delivery/LiveDeliveryMap.tsx`
- `src/components/ActiveOrderBanner.tsx`
- `src/pages/driver/DriverOrders.tsx`
- `src/components/driver/GlobalDriverTracker.tsx`

Expected result

- Reopening the iOS app restores the session reliably instead of dropping the user out.
- Protected screens do not redirect to login during brief recovery windows.
- `/order-tracking/:id` reloads correctly after reopen every time.
- Driver/live tracking reconnects after backgrounding instead of silently freezing.
- If something does fail, the app shows a recoverable state rather than endless loading.

Technical notes

- The biggest code-level issue I found is not just auth refresh itself; it is that some resume handlers refresh auth and then immediately keep using stale render-time values.
- The biggest tracking-level issue I found is that order status subscription was improved, but the driver-location/live map subscriptions were not fully brought into the same resume-safe pattern.
- The biggest persistence-level issue I found is that native session durability is still weaker than it should be because there is no explicit native-backed restore path yet.
