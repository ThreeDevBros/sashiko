

## Problem

The payment method Drawer in `CheckoutForm.tsx` has two issues causing the scroll-to-top and flickering:

1. **`shouldScaleBackground` is `true` (default)**: Vaul applies a CSS transform to scale down the background page when the drawer opens. This transform resets the scroll position and causes visible flickering. Other drawers in the app (e.g., `MenuItemDetailSheet`, `DeliveryLocationSelector`) already set `shouldScaleBackground={false}` to avoid this.

2. **No `preventScrollRestoration`**: The drawer doesn't prevent the browser from trying to restore scroll position when the body transform changes.

## Plan

### 1. Fix the Drawer in `CheckoutForm.tsx` (line 700)

Add `shouldScaleBackground={false}` to the `<Drawer>` component. This single change prevents Vaul from transforming the body element, which eliminates both the scroll-to-top jump and the visual flickering.

**File:** `src/components/checkout/CheckoutForm.tsx`
- Line 700: Change `<Drawer open={isPaymentDrawerOpen} onOpenChange={setIsPaymentDrawerOpen}>` to `<Drawer open={isPaymentDrawerOpen} onOpenChange={setIsPaymentDrawerOpen} shouldScaleBackground={false}>`

This matches the pattern used by every other well-behaved drawer in the app.

