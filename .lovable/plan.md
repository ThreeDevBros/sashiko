
## Extend Hero Banner Into Safe Area

### Problem
On iOS, the homepage shows a blank background above the hero banner because the page wrapper applies `pt-safe`, pushing the banner image below the notch/Dynamic Island area. The banner should fill edge-to-edge into the safe area, with the branch name positioned just below it.

### Changes

**1. `src/pages/Index.tsx`**
- Remove `pt-safe` from the root `<div className="min-h-screen bg-background pt-safe">` so the hero extends into the status bar area.
- Update the hero container `h-[45vh] min-h-[400px]` to also include safe-area top padding via `style={{ height: 'calc(45vh + env(safe-area-inset-top))', minHeight: 'calc(400px + env(safe-area-inset-top))' }}` so the visible content area doesn't shrink.
- Inside `renderHeroContent`, the title/description Zone 1 currently uses `pt-8 md:pt-12`. Change this to `paddingTop: 'calc(env(safe-area-inset-top) + 2rem)'` so the **branch name** sits exactly below the safe area inset.
- Keep Zone 2 (selector buttons) anchored to the bottom — no change.

### Visual Result
```text
┌─────────────────────┐ ← top of screen
│ [banner image fills │   (safe area / Dynamic Island region)
│  this region too]   │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤ ← safe-area-inset-top boundary
│ Sashiko (branch)    │ ← branch name sits right here
│ Big hero title      │
│ Subtitle text       │
│                     │
│ [Address selector]  │
│ [Branch info pill]  │
└─────────────────────┘
```

### Notes
- No other pages affected — only the Index hero.
- Other content below the hero remains in normal flow; no layout shift elsewhere.
- BottomNav and `pb-safe` behaviour at the bottom is untouched.
