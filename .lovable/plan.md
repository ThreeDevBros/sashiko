

## Problem Analysis

Two issues to address:

1. **Recurring dependency conflicts**: The base `Drawer` component defaults `shouldScaleBackground` to `true`, and `@capacitor-community/stripe` version mismatches keep causing merge conflicts when syncing.

2. **Native drawer bugginess**: On iOS WebView, the Vaul drawer library manipulates `document.body` styles (transforms, overflow, pointer-events) to create the "scale background" effect and manage scroll locking. Even with `shouldScaleBackground={false}`, Vaul still applies body style mutations (overflow hidden, pointer-events manipulation) that conflict with iOS WebView scroll behavior, causing:
   - Page content jumping when drawer opens/closes
   - Scroll position resets
   - Touch interaction jank inside the drawer

## Plan

### 1. Fix the Drawer base component to default `shouldScaleBackground={false}`

**File:** `src/components/ui/drawer.tsx`

Change the default from `true` to `false` so no drawer in the app ever applies background transforms. This prevents the issue at the root — no individual drawer can accidentally forget to set it.

Additionally, add `noBodyStyles` prop to prevent Vaul from mutating body styles entirely on native platforms. This eliminates the scroll-lock and overflow manipulation that causes jank in iOS WebViews.

### 2. Harden the payment method drawer for native WebViews

**File:** `src/components/checkout/CheckoutForm.tsx`

- Add `preventScrollRestoration` to the Drawer to prevent the browser from fighting over scroll position
- Add `-webkit-overflow-scrolling: touch` to the scrollable content area for smooth native iOS scrolling
- Ensure the DrawerContent has `onPointerDownOutside` handled to prevent dismissal conflicts

### 3. Lock `@capacitor-community/stripe` version precisely

**File:** `package.json`

Change `"@capacitor-community/stripe": "^7.0.0"` to `"@capacitor-community/stripe": "~7.0.0"` (tilde) to prevent npm from resolving to a v8 release. This prevents future dependency conflicts when Capacitor community publishes a breaking major version.

### Technical Details

The core fix is in the `Drawer` component. Vaul's default behavior adds these styles to `document.body` when a drawer opens:
- `overflow: hidden` (breaks iOS WebView scroll restoration)
- `pointer-events: none` on sibling elements
- CSS transform for background scaling

Setting `noBodyStyles` on native platforms bypasses all of this. The drawer still animates and works correctly, but the body element is left untouched — which is exactly what iOS WebViews need.

