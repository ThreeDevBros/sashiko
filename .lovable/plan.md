

## Diagnosis: App Stuck on Loading Screen

### Root cause identified

The database is currently experiencing **connection timeouts** (confirmed: the metadata query returned "Connection terminated due to connection timeout"). This causes the `useBranch` query to hang indefinitely during startup.

The app's bootstrap gate in `AppContent` waits for **both** branding and branch queries to settle before dismissing the loading screen:

```text
Bootstrap flow:
  Auth ready ─────────────── OK (fast, ~200ms)
  Branding query ─────────── OK (instant from localStorage cache via initialData)
  Branch query ───────────── HANGING (database timeout, no initialData/cache)
  Min time elapsed ───────── OK (1.2s)
  
  Result: branchLoading stays TRUE → bootstrap gate never opens
  Only the 6-second safety timeout eventually forces the app to load
```

On the published site, the safety timeout fires after 6 seconds and the Auth page appears. In the preview, the same 6-second delay applies. On native iOS, the experience is even worse because network conditions compound the database latency.

### What needs to change

**1. Cache branch data like branding is cached** (primary fix)
- Add `localStorage` caching for branch data in `useBranch`, identical to how `useBranding` uses `cached-branding-full` as `initialData`
- This makes `branchLoading` start as `false` on repeat visits, so bootstrap completes instantly
- Fresh data still fetches in the background via React Query's `refetchOnMount: true`

**2. Reduce the safety timeout from 6s to 3s**
- 6 seconds is far too long for a splash screen
- With cached data for both branding and branch, the timeout rarely fires anyway
- 3 seconds is a reasonable maximum for cold-start (first-ever visit with no cache)

**3. Add fetch timeout to the branch query**
- Wrap `fetchBranchWithFallback` in an `AbortController` with a 5-second timeout
- This prevents the query from hanging for 30+ seconds on database connection issues
- React Query's retry (1 attempt, 1.5s delay) will try once more, then settle as error

**4. Make bootstrap non-blocking when at least one data source is available**
- Currently: waits for BOTH branding AND branch to settle
- Change: proceed as soon as auth is ready AND at least one of (branding, branch) has data (from cache or fetch)
- This way even on a completely cold start, the app shows as soon as branding loads (which is fast)

### Files to modify

- `src/hooks/useBranch.ts` — add localStorage caching and initialData, add fetch timeout
- `src/App.tsx` — reduce safety timeout to 3s, relax bootstrap gate condition
- `src/lib/branch.ts` — add AbortController timeout to `fetchBranch` / `fetchBranchWithFallback`

### Expected result

- **Repeat visits**: App loads instantly (0-200ms) from cached branding + branch data
- **First visit**: App loads within 1.5-3 seconds even if database is slow
- **Database down**: App shows within 3 seconds via safety timeout, with cached data if available
- **Native iOS**: Same improvements apply, no more indefinite loading screen

