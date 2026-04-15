

## Fix: Apple Pay Button Non-Functional After Cancel

### Root Cause

There are **two separate `loading` states** — one in `Checkout.tsx` (line 93) and one in `CheckoutForm.tsx` (line 101). They are independent.

When the user clicks the "Pay with Apple Pay" button:
1. `Checkout.tsx` sets `isPlacingOrderRef.current = true` (line 1222)
2. `form.requestSubmit()` triggers `CheckoutForm.handleSubmit`
3. CheckoutForm sets its own `loading = true`, runs the wallet flow
4. On cancel, CheckoutForm sets its own `loading = false` and `isSubmittingRef.current = false`

The useEffect in Checkout.tsx (line 124) that resets `isPlacingOrderRef` watches **Checkout's** `loading` — which was never changed. So `isPlacingOrderRef.current` stays `true` permanently. On the next click, line 1221 (`if (isPlacingOrderRef.current || loading) return;`) short-circuits and nothing happens.

### Fix

Expose a callback from `CheckoutForm` to `Checkout` that resets the parent's guard when the form submission completes (success, error, or cancel). The simplest approach: pass a `onSubmissionEnd` prop from Checkout to CheckoutForm, called in the `finally` block and cancel paths.

**Alternative (simpler):** Remove `isPlacingOrderRef` entirely from the click handler in `Checkout.tsx`. The `isSubmittingRef` inside CheckoutForm already prevents duplicate submissions. The only purpose of `isPlacingOrderRef` was to prevent double-clicks, but `isSubmittingRef` in the form handler already does this.

### Changes

**`src/pages/Checkout.tsx`:**
- Remove the `isPlacingOrderRef` declaration and its useEffect
- Remove the `isPlacingOrderRef.current` check and set from the button onClick handler
- Remove all `resetGuard()` calls (the validation returns don't need it since the ref is gone)
- Keep `loading` check in onClick as the only guard: `if (loading) return;`

This is safe because `CheckoutForm.handleSubmit` has its own `isSubmittingRef` that prevents duplicate submissions at the form level.

### Files to Modify
1. `src/pages/Checkout.tsx` — Remove `isPlacingOrderRef` and all references

No database migration needed.

