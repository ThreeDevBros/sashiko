## Problem

On Android tablets, the `/auth` page renders the login UI in the top half while the bottom half shows a blank white screen. The branded gradient background does not extend to the full screen. Additionally, on some devices the page is scrollable when it should not be.

## Root Causes

1. **Inconsistent root containers across the three Auth views:**
   - Main login view (line 397–406): uses `fixed inset-0` ✅
   - Password reset view (line 296–298): uses `min-h-screen` with `bg-gradient-to-br` Tailwind classes — does NOT use the branded `login_bg_color` and relies on `100vh`, which is unreliable in Android WebView (browser chrome causes mismatch).
   - OTP verification view (line 352–359): uses `min-h-screen` — same `100vh` issue on Android.

2. **Inner card is scrollable** on the main view: `<div class="w-full max-w-md ... max-h-full overflow-y-auto">` (line 421). The user explicitly wants the page non-scrollable on every device.

3. **`min-h-screen` (100vh) on Android WebView** does not account for the system bars correctly, leaving a blank strip at the bottom on tablets.

4. **`pt-safe` adds top padding** without clipping — combined with `fixed inset-0` and large content, this can push content offscreen on small viewports, which is why scrolling was added as a workaround.

## Fix

Apply a single, consistent full-viewport, non-scrollable container pattern to **all three** Auth view branches (main, password reset, OTP) so the branded background covers the entire screen on every device, and content never scrolls.

### Container pattern (applied to all 3 branches)

```text
<div
  className="fixed inset-0 w-screen h-screen overflow-hidden flex items-center justify-center p-4"
  style={{
    minHeight: '100dvh',  // dynamic viewport height — correct on Android Chrome/WebView
    height: '100dvh',
    background: branding?.login_bg_color
      ? `linear-gradient(135deg, hsl(var(--background)) 0%, ${branding.login_bg_color} 30%, ${branding.login_bg_color} 70%, hsl(var(--background)) 100%)`
      : undefined,
    overscrollBehavior: 'none',
    paddingTop: 'env(safe-area-inset-top)',
    paddingBottom: 'env(safe-area-inset-bottom)',
  }}
>
  {/* Pattern SVG layer - absolute inset-0 */}
  {/* Content wrapper - max-w-md, NO overflow-y-auto, NO max-h-full scroll */}
</div>
```

Key changes:
- `fixed inset-0` + `h-screen` + inline `height: 100dvh` — guarantees full coverage on Android WebView (dvh = dynamic viewport height, which excludes/includes browser chrome correctly).
- `overflow-hidden` on the root — prevents ANY scrolling.
- Remove `overflow-y-auto` and `max-h-full` from the inner content wrapper.
- Apply branded gradient to ALL three views (currently the password reset view uses a hardcoded Tailwind gradient that ignores branding).
- Use safe-area insets via inline style padding so the gradient still paints behind the notch/status bar (the background still fills edge-to-edge because it's on the parent `fixed inset-0`, padding only insets the children).

### Content sizing safeguard (so nothing overflows when scrolling is disabled)

Since the content can no longer scroll, on small phones the form must always fit. Add:
- `max-h-full` to the inner `max-w-md` wrapper (so it caps at viewport height)
- `overflow-hidden` on the inner wrapper to prevent any internal scroll
- Reduce vertical spacing on smaller heights via responsive `py-` classes if needed

The current form is already compact (h-9 inputs, text-xs labels) so it fits in ~600px of vertical space, which works on all target devices (smallest: 320×568 iPhone SE).

### Files to modify

- `src/pages/Auth.tsx` — update all three view branches:
  1. Main view container (lines 397–421)
  2. Password reset view container (lines 296–299)
  3. OTP verification view container (lines 352–372)

No other files need changes. No native Android/iOS code changes required — this is purely a CSS/layout fix.

## Verification

After the change:
- Android tablet (e.g., 1280×800, 800×1280): branded gradient fills entire screen, login card centered, no white space, no scroll.
- Android phone (360×800, 412×915): same.
- iOS (390×844, 414×896, 768×1024 iPad): same.
- Desktop preview (any size): same.
