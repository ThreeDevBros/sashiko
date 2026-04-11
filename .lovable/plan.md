

# Plan: Fix Native iOS App Loading Reliability

## Root Cause

The app fails to load data on native iOS due to **three compounding issues**:

1. **No retry/resilience on QueryClient**: `new QueryClient()` is created with zero configuration — no retries, no network mode, no refetch on reconnect. On flaky mobile connections, a single failed fetch = permanently failed state.

2. **12-second safety timeout dismisses loading screen even when all data failed**: The loading screen hides after 12s regardless of whether branding/branch data actually loaded. The user sees an empty shell with default/template values.

3. **`useBranch` swallows errors silently**: When `fetchBranch()` fails, it catches the error, sets `branch = null`, `loading = false`, and the app proceeds as if there's simply no branch — showing the default/guest state.

## Solution

### 1. Configure QueryClient with mobile-grade resilience
**File: `src/App.tsx`**

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      networkMode: 'always',        // Don't pause queries on "offline" detection (unreliable on native)
      refetchOnReconnect: 'always',  // Re-fetch everything when connection restores
      staleTime: 2 * 60 * 1000,
    },
  },
});
```

### 2. Replace safety timeout with a smarter gate
**File: `src/App.tsx`**

Instead of a blind 12-second timeout that shows broken UI, change the logic:
- Keep the loading screen until core data (`branding` + `branch`) has **succeeded at least once** OR the query has **errored after all retries**.
- If everything errored, show a **"Connection failed — Tap to retry"** screen instead of showing the empty app.
- Remove the hard 12-second cap (the retry strategy with 3 retries already caps at ~15s worst-case).

### 3. Convert `useBranch` to use React Query
**File: `src/hooks/useBranch.ts`**

Currently uses raw `useState`/`useEffect` with no retry. Convert to `useQuery` so it benefits from the global retry config. Keep the real-time subscription for live updates.

### 4. Add app-resume data refresh
**File: `src/App.tsx`**

Use `useAppLifecycle` to invalidate all queries when the native app returns from background, ensuring data is always fresh.

## Files to change

1. **`src/App.tsx`** — Configure QueryClient, replace timeout with error-aware gate, add resume invalidation, add retry/error UI
2. **`src/hooks/useBranch.ts`** — Convert to `useQuery` for retry resilience
3. **`src/components/LoadingScreen.tsx`** — Add optional "retry" mode with tap-to-retry button for connection failures

## Technical details

- `networkMode: 'always'` is critical — React Query's default online detection uses `navigator.onLine` which is unreliable inside Capacitor WebViews and can permanently pause queries
- 3 retries with exponential backoff (1s, 2s, 4s) covers typical mobile network hiccups without excessive delay
- The loading screen will show a retry button only after all retries exhausted, not on first failure
- `refetchOnReconnect: 'always'` ensures that if the WebSocket/network recovers, stale data is refreshed automatically

