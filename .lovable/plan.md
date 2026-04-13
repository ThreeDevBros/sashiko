

## Plan: Fix Slow Page Loads — Deduplicate useBranch Side Effects

### Root cause

`useBranch()` is called from 14 components. Each call creates its own:
- **60-second interval** polling `calculateEstimatedTime` (a database query)
- **Realtime channel** subscription to the `branches` table
- **Resume listener**

When 5-8 of these components are mounted simultaneously (e.g. Index + BottomNav + BranchInfoPill + FloatingBranchWidget + MenuDisplay), you get 5-8 parallel database polls every 60 seconds, 5-8 duplicate realtime connections, and cascading "Failed to fetch" errors that compound with retries.

### Changes

**1. Move all side effects out of `useBranch` hook into a single provider** (`src/hooks/useBranch.ts`)

- Remove the `useEffect` for the 60-second `calculateEstimatedTime` interval from the hook
- Remove the `useEffect` for the realtime channel subscription from the hook  
- Remove the `useEffect` for the resume listener from the hook
- Keep only the `useQuery` call and event listener for `branchChanged`
- Create a single `BranchRealtimeManager` component (rendered once in `App.tsx`) that owns:
  - One realtime subscription
  - One 60-second estimated time interval
  - One resume listener

**2. Make `calculateEstimatedTime` failures silent** (`src/lib/branch.ts`)

- The function already catches errors, but the interval keeps retrying every 60s even during network outages
- Add a simple backoff: if the last call failed, skip the next interval tick

**3. Debounce the geocode calls** (`src/App.tsx`, `src/hooks/useNearestBranch.ts`)

- Both `AppContent` and `useNearestBranch` call `geocode-location` on startup
- Guard the `AppContent` location detection to skip if `useNearestBranch` already ran (check localStorage for existing location data before invoking the edge function)

### Files to modify

- `src/hooks/useBranch.ts` — strip side effects, keep only query + cache reads
- `src/components/BranchRealtimeManager.tsx` — new file, singleton side-effect owner
- `src/App.tsx` — mount `BranchRealtimeManager` once; guard duplicate geocode call
- `src/lib/branch.ts` — add failure backoff to `calculateEstimatedTime`

### Expected result

- Only **1** realtime channel for branch updates (instead of 5-8)
- Only **1** interval polling estimated time (instead of 5-8)
- No duplicate geocode edge function calls on startup
- Pages load without waiting for failed network requests to timeout and retry

