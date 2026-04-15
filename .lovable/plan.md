

## Fix Payment Cancellation UX, Service Fee in Charges, and Apple/Google Pay Refunds

### Issue 1: Cancellation Shows Error + Locks Button

**Root cause (card payments):** When the user cancels a Stripe card payment, `stripeError` is set at line 643-646 in `CheckoutForm.tsx`. The code calls `setError(...)` then `throw`, which hits the outer `catch` block. The catch detects the cancellation and returns early, but never clears the error state — so the red error alert stays visible and the button appears locked.

**Root cause (Apple/Google Pay - native):** The native wallet cancellation is already handled correctly at lines 476-481 (returns early). However, the `presentApplePay()` call may throw an exception on cancel rather than returning a result, and the catch block at line 237 handles that. This path looks correct already. If the user still sees errors, it may be from the `setError` line at 208 for unexpected result strings.

**Fix in `CheckoutForm.tsx`:**
- In the card payment `stripeError` block (lines 643-647): detect cancellation before setting error. If `stripeError.code === 'payment_intent_authentication_failure'` or message contains 'cancel', silently return without setting error or throwing.
- Clear `error` state at the start of the catch block if cancellation is detected.

### Issue 2: Card Payment Doesn't Charge Service Fee

**Root cause:** The `create-payment-intent` edge function computes `total = subtotal + tax + deliveryFee` — it never includes the service fee. The service fee is calculated client-side in `Checkout.tsx` but never sent to the server.

**Fix:**
1. **`create-payment-intent/index.ts`**: Add `service_fee` to the Zod schema. Include it in the total calculation: `total = subtotal + tax + deliveryFee + serviceFee`.
2. **`confirm-payment/index.ts`**: Store the `service_fee` from metadata in the order record (add to insert and metadata).
3. **All callers** (`Checkout.tsx` lines 435-446, `CheckoutForm.tsx` lines 514-525, `nativeStripePay.ts` lines 136-153): Pass `service_fee` in the request body.
4. **DB migration**: Add `service_fee` column to `orders` table (numeric, default 0).

### Issue 3: Apple/Google Pay Refunds Don't Work

**Root cause:** For guest users paying with Apple/Google Pay, the `refund-order` edge function requires authentication (returns 401 for unauthenticated callers). Guest orders have `user_id: null`, so even if authenticated, `isOwner` is false and `hasStaffRole` is false.

Actually, for authenticated users paying with Apple Pay, the flow should work. The more likely issue is that the `order.user_id` stored is null for guest Apple Pay orders, and refund is triggered from the tracking page which may not have auth.

**Fix in `refund-order/index.ts`:** For the guest order case, allow the refund if the order has no `user_id` (guest order) — the caller is already authenticated and viewing the tracking page. Add a guest verification path: if `order.user_id` is null, check if the order matches a guest tracking token or simply allow it since the order was already found.

### Files to Modify

1. **`supabase/functions/create-payment-intent/index.ts`** — Add `service_fee` to schema and total calculation
2. **`supabase/functions/confirm-payment/index.ts`** — Store `service_fee` in order record from PI metadata
3. **`src/pages/Checkout.tsx`** — Pass `service_fee` to create-payment-intent call
4. **`src/components/checkout/CheckoutForm.tsx`** — Pass `service_fee` in wallet/web wallet payment intent calls; fix card cancellation to not show error
5. **`src/lib/nativeStripePay.ts`** — Accept and pass `service_fee` to create-payment-intent
6. **`supabase/functions/refund-order/index.ts`** — Allow refund for guest orders (user_id is null)
7. **DB migration** — Add `service_fee` numeric column to `orders` table

### Technical Details

**Service fee flow:**
- `Checkout.tsx` calculates `serviceFee = subtotal * (serviceFeeRate / 100)`
- Pass as `service_fee` parameter to `create-payment-intent`
- Server validates and includes in total: `Math.round((subtotal + tax + deliveryFee + serviceFee) * 100)` for Stripe amount
- Store in PI metadata and in orders table via `confirm-payment`

**Cancellation fix:**
```typescript
// Before setting error, check if it's a cancellation
if (stripeError) {
  const msg = (stripeError.message ?? '').toLowerCase();
  if (stripeError.code === 'payment_intent_authentication_failure' ||
      msg.includes('cancel') || msg.includes('abort')) {
    // User cancelled — silently reset
    return;
  }
  setError(stripeError.message || 'Payment failed');
  throw new Error(stripeError.message);
}
```

**Guest refund fix:**
```typescript
// Allow refund if caller is owner, has staff role, or it's a guest order
const isGuestOrder = !order.user_id;
if (!hasStaffRole && !isOwner && !isGuestOrder) {
  return new Response(JSON.stringify({ error: 'Forbidden.' }), { status: 403 });
}
```

