

## Fix `/support` Page Visibility and Accessibility

### Issues Found
1. **Route works but may render incorrectly** — `/support` uses a raw `<Suspense>` wrapper instead of `<AnimatedPage>` like every other route, which can cause blank renders inside `AnimatePresence mode="wait"`.
2. **Not in admin sidebar** — The admin sidebar (`AdminLayout.tsx`) has no link to `/support`. It's only visible inside the Hidden Pages tab in Configure, which requires scrolling.
3. **Not in navigation map** — `/support` is missing from `src/lib/navigation.ts`, so the back button won't work correctly.

### Plan

1. **Fix the route rendering** (`src/App.tsx`)
   - Wrap `/support` in `<AnimatedPage>` like all other routes instead of bare `<Suspense>`

2. **Add `/support` to navigation map** (`src/lib/navigation.ts`)
   - Add `/support` → `/` entry so back button navigates home

3. **Ensure the Hidden Pages tab is visible** — Already confirmed working in code. If the issue persists after the route fix, the page itself should render correctly when navigated to.

### Technical Details
- The root cause is likely that `AnimatePresence mode="wait"` expects consistent child wrappers with motion components. A raw `<Suspense>` child without the `motion.div` wrapper from `AnimatedPage` can cause the component to not animate in or appear blank.
- No database or RLS changes needed — the `branches` table already allows public SELECT.

