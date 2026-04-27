# Restore original auth gradient shading while keeping overflow coverage

## Problem
The previous edit stretched the gradient to 200vw × 200vh, which shifted the dark→orange→dark color stops and changed the look. The user wants the **exact original shading** but the layer to still extend beyond the visible viewport so no edge ever shows blank.

## Fix
In `src/pages/Auth.tsx`, on all three gradient background layers (password reset block, OTP block, main auth return), change the inline style from:

```ts
background: `linear-gradient(135deg, hsl(var(--background)) 0%, ${branding.login_bg_color} 30%, ${branding.login_bg_color} 70%, hsl(var(--background)) 100%)`
```

to:

```ts
backgroundColor: 'hsl(var(--background))',
backgroundImage: `linear-gradient(135deg, hsl(var(--background)) 0%, ${branding.login_bg_color} 30%, ${branding.login_bg_color} 70%, hsl(var(--background)) 100%)`,
backgroundSize: '100vw 100vh',
backgroundPosition: '50vw 50vh',
backgroundRepeat: 'no-repeat',
```

## Why this works
- The layer stays 200vw × 200vh anchored at `-50vw / -50vh` (already in place) — guarantees full coverage on any device, orientation, or URL-bar resize.
- The gradient itself is now constrained to exactly **one viewport** (`100vw × 100vh`) and positioned so it lands precisely over the visible screen area.
- This means the dark→orange→dark color stops fall at the same screen positions as before — pixel-identical shading inside the visible area.
- The surrounding overflow margin (the extra 50% on each side) is filled with the solid `hsl(var(--background))` (the dark color the gradient already starts and ends with), so it blends seamlessly with no visible seam.

## Files changed
- `src/pages/Auth.tsx` — 3 inline-style blocks (lines ~300, ~383, ~449)

No other behavior changes. Card layout, z-index, safe-area padding, overscroll behavior all stay exactly as they are.