

# Plan: Ensure Live Activity Code is Deployed + Add Failsafe Logging

## Problem
No `[LiveActivity]` logs appear at all in Xcode, meaning either:
1. The latest web assets (with our logging) were never actually copied to the iOS bundle
2. The useEffect never fires (unlikely for a logged-in user with an active order)

## Steps

### Step 1: Verify web assets are synced
You need to rebuild and re-copy web assets to the iOS project. Run from the project root:

```bash
npm run build && npx cap copy ios
```

Then open Xcode (`npx cap open ios` from project root), clean build (Cmd+Shift+K), and run again.

### Step 2: Add top-level logging to the Live Activity useEffect
Add a `console.log` at the very top of the useEffect (before the `isGuest` guard) so we can confirm the effect runs at all, regardless of conditions:

**File: `src/pages/OrderTracking.tsx` (line 127-128)**

Add before the guard:
```typescript
console.log('[LiveActivity] useEffect fired — order:', order?.id, 'status:', order?.status, 'isGuest:', isGuest);
```

This will confirm whether the effect runs on the device and what values it sees.

### Step 3: No other code changes needed
The existing logging in `nativeLiveActivity.ts` is already comprehensive. Once we confirm the effect fires and reaches the plugin calls, we'll see exactly where it fails.

## Technical Details
- The previous build attempt had errors during `cap update` which may have left stale web assets in `ios/App/App/public/`
- `npx cap copy ios` specifically copies web assets; `npx cap sync` does copy + pod install
- A clean build in Xcode ensures no cached JS is served

