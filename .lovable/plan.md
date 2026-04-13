

# Fix: Loading Screen Getting Stuck on Cold Start / Resume

## Root cause

Two issues cause the loading screen to persist indefinitely:

1. **No timeout on initial session restore** — The `restore()` function in `AuthContext.tsx` calls `supabase.auth.setSession()` during native session recovery (when iOS has cleared localStorage). If this network call hangs or is slow, `isAuthReady` never becomes `true` and the loading screen stays forever. Unlike `refreshSession()` which has an 8-second timeout, `restore()` has none.

2. **`isAuthRecovering` blocks initial bootstrap** — The bootstrap gate in `App.tsx` (line 360) returns early when `isAuthRecovering` is true. If a visibility/resume event fires during the initial 1200ms splash window, `refreshSession()` sets `isAuthRecovering = true`, which blocks bootstrap from completing until the refresh finishes AND queries re-settle (since `queryClient.invalidateQueries()` resets loading states).

## Fix

### 1. `src/contexts/AuthContext.tsx` — Add timeout to `restore()`

Wrap the native `setSession()` call in a `Promise.race` with a 5-second timeout, same pattern as `refreshSession()`. If it times out, proceed without the native session (user will need to log in again). Also ensure `isAuthReady` is set to `true` no matter what via the existing `finally` block.

### 2. `src/App.tsx` — Remove `isAuthRecovering` from bootstrap gate

Remove the `if (isAuthRecovering) return;` line from the bootstrap effect. This check was meant to prevent premature rendering, but `bootstrapComplete` is a one-shot flag — once set, it never resets. Blocking bootstrap on `isAuthRecovering` only delays the initial load if a resume event fires during startup. The `authVersion` key already handles recovery by forcing a remount.

### 3. `src/App.tsx` — Add a global safety timeout for the loading screen

Add a 10-second max timer: if `showLoadingScreen` is still true after 10 seconds, force-dismiss it and set `bootstrapComplete = true`. This ensures the app never gets permanently stuck regardless of network conditions.

## Files to modify

- `src/contexts/AuthContext.tsx` — timeout on native `setSession()` in `restore()`
- `src/App.tsx` — remove `isAuthRecovering` from bootstrap gate, add safety timeout

## Technical detail

```text
Before:
  restore() → setSession() hangs → isAuthReady never true → infinite loading

After:
  restore() → setSession() races with 5s timeout → isAuthReady = true
  bootstrap gate no longer blocked by isAuthRecovering
  10s global safety timeout ensures loading screen always dismisses
```

