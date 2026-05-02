# Fix items visible under the notch on Order/Items page

## Problem
On the iOS native app, the sticky category chip bar in the menu (`/order`) sits below the notch using `top-safe` (which equals `env(safe-area-inset-top)`). Because that bar is positioned *below* the safe area, the strip of space between the notch and the chips is transparent. Menu items scroll through that transparent strip and are visible up near the notch before reaching the bar — looking messy.

You want that strip filled with the page background color so items appear to slide cleanly *under* the sticky bar (hidden), instead of showing in the safe-area gap.

## Scope
**Only the Items menu** (`MenuDisplay` used on `/order` and `/menu/:branchId`). Do not touch other sticky bars (e.g. management headers, profile, etc.).

## Change

### File: `src/components/MenuDisplay.tsx`

Restructure the sticky category bar so the notch area is part of the same opaque sticky block.

Currently:
```tsx
<div className="sticky top-safe md:top-14 z-40 bg-background border-b border-border shadow-sm">
  <div ref={categoryScrollRef} className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
    {/* chips */}
  </div>
</div>
```

Change to:
```tsx
<div
  className="sticky top-0 md:top-14 z-40 bg-background border-b border-border shadow-sm"
  style={{ paddingTop: 'env(safe-area-inset-top)' }}
>
  <div ref={categoryScrollRef} className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
    {/* chips */}
  </div>
</div>
```

On desktop (`md:`) the `top-14` keeps it pinned below the TopNav as today, and `env(safe-area-inset-top)` resolves to `0` so nothing changes visually on web/desktop. On the iOS native app, the bar now anchors at the very top of the viewport and pads itself down to clear the notch — the entire notch strip is filled with `bg-background`, so items scrolling underneath are completely hidden by it.

### Loading skeleton (same file)

The skeleton sticky bar uses the same `top-safe` pattern. Apply the same restructure for visual consistency during loading:

```tsx
<div
  className="fixed left-0 right-0 top-0 md:top-14 z-40 bg-background py-3 border-b border-border"
  style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
>
  <div className="flex gap-2 px-4 overflow-x-auto">{/* skeleton chips */}</div>
</div>
```

### Section scroll offset (same file)

Each `<section>` currently uses `scroll-mt-safe md:scroll-mt-[68px]` so anchor scrolls land below the sticky bar. Now the bar's effective height = `safe-area-inset-top + chip row height (~64px)`, so update to:

```tsx
className="scroll-mt-[calc(env(safe-area-inset-top)+64px)] md:scroll-mt-[68px]"
```

This keeps `scrollToCategory` jumps landing right under the bar on both notched iOS and desktop.

## Out of scope
- No changes to `TopNav`, `BottomNav`, admin pages, profile, or any other sticky element.
- No theme/color changes — uses the existing `bg-background` token, so it adapts to Light / Dark Grey / True Black themes automatically.
- No Capacitor config or native code changes.
