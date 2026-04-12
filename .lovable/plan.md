

# Plan: Fix App Resume Reliability on Native iOS

## Root causes identified

After reviewing every file involved, the ChatGPT checklist maps to **3 concrete issues** in this codebase:

### Issue 1: Realtime channel breaks after backgrounding
The Supabase Realtime WebSocket disconnects when iOS suspends the app. On resume, `resumeCounter` increments to force a new channel — but the channel name `order-status-${orderId}` is reused. Supabase may reject a duplicate channel name if the old one hasn't fully torn down yet. This means **status updates stop arriving** after reopen.

**Fix**: Append `resumeCounter` to the channel name so each reconnection gets a unique channel: `order-status-${orderId}-${resumeCounter}`.

### Issue 2: Stale closure in realtime callback
The realtime `postgres_changes` callback references `order?.status` from its closure, but this value is stale after the effect re-runs because `order?.status` is also a dependency. When the channel recreates, the old status is captured. This can cause missed toast notifications and incorrect diff logic.

**Fix**: Use a ref (`orderStatusRef`) to always read the latest status inside the callback instead of relying on the closure value.

### Issue 3: Auth session not awaited before data fetch on resume
In `OrderTracking`, `useAppLifecycle` calls `loadOrderDetails()` immediately. But in `App.tsx`, the *other* `useAppLifecycle` hook calls `refreshSession()` first. These two hooks fire independently — the OrderTracking one may fetch data with an expired token before the App-level one has refreshed it. This causes **RLS failures / empty data** on resume.

**Fix**: In `OrderTracking`'s resume handler, call `refreshSession()` before `loadOrderDetails()` to ensure the token is valid. Import `useAuth` is already available.

### Issue 4: 60s poll interval resets on every status change
The 60s polling effect depends on `order?.status`. Every time status changes (via realtime), the interval restarts — meaning the poll timer resets. This is minor but can cause gaps.

**Fix**: Remove `order?.status` from the 60s poll deps. Use a ref for terminal-status checking instead.

## Files to modify

1. **`src/pages/OrderTracking.tsx`**
   - Unique channel name with `resumeCounter`
   - Ref-based status reading in realtime callback
   - `refreshSession()` before `loadOrderDetails()` in resume handler
   - Stabilize 60s poll deps

2. **`src/hooks/useAppLifecycle.ts`** — no changes needed (already correct)

3. **`src/contexts/AuthContext.tsx`** — no changes needed

## What this fixes
- Order tracking page shows correct data immediately after reopening the app
- Realtime updates continue working after backgrounding
- No stale auth tokens causing empty/failed queries
- 60s Live Activity sync poll runs consistently without resets

