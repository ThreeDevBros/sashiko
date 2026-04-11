
Goal

Make the app recover cleanly after backgrounding/returning on iOS, Android, and web so data fetching, auth-protected screens, realtime updates, and navigation remain stable.

What I found

This looks like a client lifecycle/bootstrap problem more than a backend data problem.

- `useAppLifecycle` fires resume twice on native because it listens to both `visibilitychange` and Capacitor `appStateChange`. Your logs confirm duplicate resume events:
  - `[App] Resumed — invalidating all queries` appears twice each time.
- `App.tsx` currently does a global `queryClient.invalidateQueries()` on every resume. That creates a refetch storm across the whole app.
- Several protected queries/subscriptions start before auth/role/session state is fully safe again after resume.
- `AuthContext` still marks auth ready too early for native lifecycle edge cases. That can briefly make protected queries run while the token/session is not fully usable, which makes RLS-backed fetches fail or return empty.
- Realtime reconnect is only handled in a few places. Most staff/admin/branch/driver subscriptions do not explicitly re-subscribe on resume, so WebSocket-backed updates can silently die after reopening the app.
- Route/role checks are spread across multiple places and can race during resume, causing wrong redirects or broken page state.

Plan

1. Stabilize auth restoration first
- Refactor `src/contexts/AuthContext.tsx` into a stricter “session restored” flow.
- Restore session with `getSession()` first, then mark auth ready only after that restore completes.
- Avoid any awaited async work inside `onAuthStateChange`.
- Expose a stronger auth-ready signal for the rest of the app to use.

2. Fix duplicate resume handling
- Update `src/hooks/useAppLifecycle.ts` to dedupe native resume events so foregrounding only triggers once.
- Add a short guard/throttle so `visibilitychange` + `appStateChange` do not both fire the same refresh cycle.

3. Replace global resume invalidation with a controlled refresh pipeline
- In `src/App.tsx`, remove the blanket “invalidate everything” behavior.
- Replace it with staged resume refresh:
  - refresh auth/session-dependent state first
  - refresh core bootstrap data (`branding`, `branch`)
  - refresh only critical shared user data
- Keep the last good UI visible while background refresh happens instead of destabilizing the whole tree.

4. Gate protected queries and route guards correctly
- Audit and update auth-dependent logic so it waits for real auth readiness before querying:
  - `src/App.tsx` route/role checks
  - `src/hooks/useAdmin.ts`
  - `src/hooks/usePermissions.ts`
  - `src/hooks/useSavedCards.ts`
  - `src/pages/DriverDashboard.tsx`
  - `src/pages/staff/StaffReservations.tsx`
  - any other screen querying protected tables on mount
- Use proper React Query `enabled` guards and avoid `getUser()`/role fetch races during resume.

5. Centralize role/permission loading
- Stop re-fetching roles ad hoc in multiple places during resume.
- Introduce a shared cached role/permission source so layouts, guards, and panels all read from the same settled state.
- This will prevent redirects and access checks from fighting each other when the app reopens.

6. Add app-resume reconnect for realtime everywhere it matters
- Generalize the same reconnect pattern already used in order tracking.
- Re-subscribe critical realtime channels on resume for:
  - `src/hooks/useBranch.ts`
  - `src/pages/admin/OrderManagement.tsx`
  - `src/pages/staff/StaffOrders.tsx`
  - `src/pages/staff/StaffReservations.tsx`
  - `src/components/driver/GlobalDriverTracker.tsx`
  - any other critical live dashboards
- Pair reconnect with an immediate refetch fallback so the page heals even if the socket was dead.

7. Make resume-safe UI states for active panels
- Ensure admin/staff/driver layouts do not render “access denied” or partial broken states while auth/roles are still settling after resume.
- Keep loading/skeleton states until permissions are truly ready.

8. Verify bootstrap remains resilient after reopening
- Re-test the startup bootstrap gate in `src/App.tsx` so reopening the app does not recreate the earlier “data doesn’t load properly” failure mode.
- Preserve cached branding/branch while refetching, and only show failure UI for real persistent failures.

Files likely involved

- `src/contexts/AuthContext.tsx`
- `src/hooks/useAppLifecycle.ts`
- `src/App.tsx`
- `src/hooks/useAdmin.ts`
- `src/hooks/usePermissions.ts`
- `src/hooks/useSavedCards.ts`
- `src/hooks/useBranch.ts`
- `src/pages/admin/OrderManagement.tsx`
- `src/pages/staff/StaffOrders.tsx`
- `src/pages/staff/StaffReservations.tsx`
- `src/pages/DriverDashboard.tsx`
- `src/components/driver/GlobalDriverTracker.tsx`

Expected result

After this fix:
- reopening the app triggers one clean refresh instead of duplicate storms
- auth-protected data no longer fetches during the broken session window
- admin/staff/driver/customer screens recover correctly after backgrounding
- realtime updates reconnect reliably after returning to the app
- the app remains usable instead of falling into partial empty/broken states
