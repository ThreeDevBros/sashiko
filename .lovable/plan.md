

# Fix Plan: Payment Drawer, Apple Pay Cancellation, and Cash Order Errors

## Problem Summary

Three distinct issues identified:

1. **Apple Pay cancellation shows wrong error**: When user cancels Apple Pay, `presentApplePay()` resolves (doesn't throw). The code then calls `confirm-payment` which sees payment status `requires_payment_method` and returns an error. This triggers the misleading message "Payment succeeded but order creation failed."

2. **Cash order throws "couldn't process payment" error**: The `create-cash-order` edge function fails with a foreign key violation: `orders.user_id` references `profiles`, but the logged-in user has no profile row. The error falls through to the generic catch block showing "We couldn't process your payment."

3. **Payment drawer needs backdrop blur and proper swipe-to-dismiss**: The Vaul drawer needs a blurred backdrop and should dismiss smoothly when swiped down on all platforms.

---

## Changes

### 1. Fix Apple Pay cancellation detection (`src/lib/nativeStripePay.ts`)

After `presentApplePay()` / `presentGooglePay()`, check the result status. The `@capacitor-community/stripe` plugin returns `{ paymentResult: 'Completed' | 'Canceled' | 'Failed' }`. If the result is not `Completed`, return early as cancelled or failed — do NOT call `confirm-payment`.

```text
presentApplePay() → check result.paymentResult
  'Completed' → proceed to confirm-payment
  'Canceled'  → return { cancelled: true }
  Other       → return { error: 'Payment not completed' }
```

### 2. Fix cash order foreign key error (`supabase/functions/create-cash-order/index.ts`)

Before inserting the order, check if the user has a profile. If not, create one automatically using the service role client. This handles the case where a user authenticated but never got a profile row created.

### 3. Improve payment drawer UX (`src/components/ui/drawer.tsx` + `CheckoutForm.tsx`)

- Add `backdrop-blur-sm` to the `DrawerOverlay` component for the blur effect across all platforms
- The Vaul drawer already handles swipe-to-dismiss natively; the blur addition will make the background effect consistent

### 4. Better error message for confirm-payment failures (`src/lib/nativeStripePay.ts`)

Change the error message on line 204 from "Payment succeeded but order creation failed" to something less alarming, since this path is now only reachable for genuine server errors (not cancellations).

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/nativeStripePay.ts` | Check `presentApplePay`/`presentGooglePay` result before calling confirm-payment |
| `supabase/functions/create-cash-order/index.ts` | Auto-create profile if missing before order insert |
| `src/components/ui/drawer.tsx` | Add `backdrop-blur-sm` to DrawerOverlay |
| `src/components/checkout/CheckoutForm.tsx` | Improve error handling for cash order path |

