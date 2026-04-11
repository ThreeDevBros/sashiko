
Goal

Make the native iOS app boot reliably every time, with the correct signed-in session, branding, branch, and menu data loaded before the UI leaves the startup state.

What I found

This is primarily a client startup race, not a backend data problem.

- The backend has data: 1 active branch, 1 tenant settings row, 7 available menu items, 7 available branch menu items.
- Public read policies for tenant settings, branches, menu items, branch menu items, and menu categories are in place, so missing public data is not caused by RLS.
- The app still mounts too much before startup is stable:
  - `App.tsx` renders the whole app tree hidden behind the loading screen, so background startup effects still run immediately.
  - `precacheSavedCards(queryClient)` runs at module load, before auth restoration is complete.
  - `LoadingScreen.tsx` performs its own `menu_items` query, so even the splash can look broken on slow/native starts.
- Auth is still inconsistent across the app:
  - `AuthContext` restores the session, but many screens/hooks still call `supabase.auth.getUser()` / `getSession()` directly on mount and decide “guest vs signed-in” too early.
  - I found this pattern in startup-relevant files like `useAdmin`, `usePermissions`, `Profile`, `OrderHistory`, `DriverDashboard`, `DriverOrders`, `GlobalDriverTracker`, `PhonePromptDialog`, and others.
- Branch loading is still brittle:
  - `src/lib/branch.ts` swallows fetch errors and returns `null`.
  - `useBranch` treats “saved branch ID is stale”, “network failure”, and “no branch exists” too similarly.
  - If a cached `selectedBranchId` is invalid, the app can fail to resolve a branch instead of falling back to the first active one.
- Startup side effects are competing during launch:
  - geolocation bootstrap
  - nearest-branch auto-selection
  - push registration
  - driver tracker
  - phone prompt checks
  These all start while auth/core data may still be unsettled.

Implementation plan

1. Build a real startup bootstrap gate
- Introduce a single startup state in `App.tsx` driven by:
  - auth restored
  - branding settled
  - branch settled
  - bootstrap errors classified
- Keep the app in startup mode until those critical pieces are resolved.
- Do not allow the visible app shell to proceed into guest/default mode while auth/core data is still indeterminate.

2. Stop the loading screen from depending on network data
- Remove the `menu_items` query from `src/components/LoadingScreen.tsx`.
- Use static/cached visuals only for the splash so it always renders correctly, even when the network is slow.

3. Harden branch resolution and fallback logic
- Update `src/lib/branch.ts` and `src/hooks/useBranch.ts` so branch loading:
  - distinguishes network error vs empty result
  - retries cleanly through React Query
  - falls back from stale saved branch ID to the first active branch
  - caches the last known good branch ID only when valid
- Prevent silent `null` branch states from looking like “no restaurant data exists”.

4. Centralize auth readiness and remove mount-time auth races
- Sweep startup-critical files and replace direct auth checks on mount with `useAuth()` + `isAuthReady`.
- Convert startup-relevant role/profile/driver checks to wait for restored auth instead of calling `getUser()` immediately.
- Priority files:
  - `src/hooks/useAdmin.ts`
  - `src/hooks/usePermissions.ts`
  - `src/pages/Profile.tsx`
  - `src/pages/OrderHistory.tsx`
  - `src/pages/DriverDashboard.tsx`
  - `src/pages/driver/DriverOrders.tsx`
  - `src/components/driver/GlobalDriverTracker.tsx`
  - `src/components/PhonePromptDialog.tsx`

5. Delay non-critical native side effects until bootstrap is stable
- Gate these until auth/core startup is settled:
  - push notification registration
  - driver tracker startup
  - phone prompt profile check
  - location-based nearest branch auto-selection
- This reduces launch-time contention and prevents early guest assumptions.

6. Fix startup prefetch behavior
- Move saved-card prefetch out of module scope and only run it after auth is ready and a user exists.
- Avoid any eager query that can lock in a false guest/empty state during cold start.

7. Add targeted startup diagnostics and retry paths
- Add structured logs around:
  - session restoration
  - branding success/failure
  - branch resolution path
  - stale branch fallback
  - bootstrap completion
- Keep the current retry UI, but make it retry the full bootstrap path, not just generic query invalidation.

Files to change

- `src/App.tsx`
- `src/components/LoadingScreen.tsx`
- `src/hooks/useBranch.ts`
- `src/lib/branch.ts`
- `src/contexts/AuthContext.tsx`
- `src/hooks/useAdmin.ts`
- `src/hooks/usePermissions.ts`
- `src/pages/Profile.tsx`
- `src/pages/OrderHistory.tsx`
- `src/pages/DriverDashboard.tsx`
- `src/pages/driver/DriverOrders.tsx`
- `src/components/driver/GlobalDriverTracker.tsx`
- `src/components/PhonePromptDialog.tsx`
- likely a small follow-up sweep in other startup-sensitive files still using direct `getUser()`/`getSession()`

Technical notes

- I do not think the core issue is backend data absence or RLS.
- I also do not see a production Capacitor `server.url` misconfiguration in `capacitor.config.ts`; that part looks fine.
- The biggest issue is that the app still behaves as if auth and core public data are independent, while on native cold starts they must be treated as one coordinated bootstrap flow.

Success criteria

After this fix:
- cold start on iOS always waits for a real bootstrap result
- signed-in users do not appear as guests during startup
- branch/menu/branding do not fall back to empty/default state because of one failed first request
- the splash always renders consistently
- reopening the app refreshes data without inconsistencies
