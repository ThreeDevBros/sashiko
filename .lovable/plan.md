
Goal

Fix the native iOS background/foreground behavior without adding background fetch. The main issue is not “missing background execution” for the app UI — it is unstable session restore, over-eager refetching, and a fragile Live Activity token/update flow.

What I found

- No, background fetch is not the right primary fix for the broken app experience after reopening. The app already has resume hooks and server-driven Live Activity updates; the instability is happening when the WebView comes back to the foreground.
- Live Activity updates while the app is closed should already be handled server-side by `send-order-push` and `update-order-eta`. If that still fails, the likely weak point is token registration/persistence rather than needing background fetch.
- `src/App.tsx` still does resume-time invalidation of shared bootstrap queries. Combined with many components that independently refetch on resume, this can still create a refetch storm.
- Several places still call `supabase.auth.getUser()` inside query functions and polling loops instead of using settled auth context. After iOS resume, that pattern is fragile and can temporarily behave like the user is signed out.
- Role/permission/branch loading is still duplicated across hooks (`useAdmin`, `usePermissions`, `useRoleRedirect`, `StaffBranchContext`, pages). Those independent fetches can race after resume and leave the app in inconsistent states.
- Some realtime subscriptions reconnect, but many data sources still rely on ad hoc fetch logic rather than a centralized “resume-safe” refresh strategy.
- In `src/lib/nativeLiveActivity.ts`, push token registration is tied to a one-time listener and captures the original `data.orderId`. That is risky if multiple Live Activities are started over time and can associate tokens with the wrong order or fail to persist them reliably.
- In `src/pages/OrderTracking.tsx`, Live Activity ETA on the client still uses only `estimated_ready_at` in `computeEtaMinutes`, while the server uses `estimated_ready_at + delivery_transit_minutes`. That mismatch can make the in-app page and background Live Activity drift.

Plan

1. Harden the resume pipeline
- Refactor `App.tsx` so resume does not broadly invalidate shared state unless necessary.
- Add a single resume coordinator that:
  - refreshes session first
  - waits for auth restoration to settle
  - then triggers only targeted refreshes for visible/critical data
- Keep last known good UI mounted while refresh happens.

2. Centralize auth-safe identity/role state
- Create one shared source of truth for:
  - current user
  - roles
  - permissions
  - staff branch assignments
- Make `useAdmin`, `usePermissions`, `useRoleRedirect`, and `StaffBranchContext` consume that shared state instead of each calling the backend separately on mount/resume.

3. Remove fragile `getUser()` calls from runtime-critical paths
- Replace `supabase.auth.getUser()` inside query functions, intervals, and resume handlers with `useAuth()`-backed state where possible.
- Audit especially:
  - `useSavedCards`
  - `OrderTracking`
  - `StaffReservations`
  - `StaffBranchContext`
  - driver pages/components
  - banner components

4. Make realtime recovery consistent
- Apply one standard reconnect pattern to all critical views:
  - explicit resume-triggered resubscribe
  - immediate refetch fallback after resubscribe
  - stable unique channel names
- Cover customer, staff, driver, and admin flows consistently.

5. Fix Live Activity token reliability
- Refactor `src/lib/nativeLiveActivity.ts` so the push-token listener does not capture stale order data.
- Persist/update the token with the current activity/order explicitly.
- Add safer cleanup/re-registration behavior so a token survives app reopen cycles and later server-side updates still target the active Live Activity.

6. Make ETA identical everywhere
- Update `OrderTracking.tsx` client ETA logic to use the same final ETA model as the server:
  - prep time
  - plus saved delivery transit minutes for delivery orders
- Ensure the value shown on `/order-tracking` matches what is sent to the Live Activity.

7. Reduce resume-time bootstrap failures
- Keep branding/branch/customer-visible cached data available during reconnect instead of letting the app fall into broken intermediate states.
- Add proper `enabled` guards and loading states for protected queries until auth + identity state are fully restored.

8. Verify server-side Live Activity update path
- Inspect the token storage/update flow and edge-function logs for:
  - missing `live_activity_tokens`
  - token/order mismatches
  - failed APNs pushes after status changes
- If needed, tighten the order-status update flow so every staff/admin status change reliably triggers the server-side Live Activity update path.

Expected result

- Reopening the native iOS app no longer breaks fetching, roles, banners, tracking, or dashboards.
- Live Activity continues updating while the app stays closed, without needing background fetch.
- `/order-tracking` ETA matches the Live Activity ETA exactly.
- Resume no longer causes auth/query races or partial app failure states.

Technical notes

- Background fetch would only be useful if you wanted the app itself to wake periodically and do work in the background. That is not the right fix for this problem.
- For Live Activities, the correct architecture is server-driven push updates while the app is closed, plus a stable client token-registration path.
- The highest-risk code areas are currently duplicated auth-dependent fetches and the Live Activity token listener closure in `src/lib/nativeLiveActivity.ts`.
