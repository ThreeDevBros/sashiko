

## Fix: Backend Charges More Than UI Shows

### Root Cause

The `create-payment-intent` edge function independently recalculates the total:
```
subtotal (from DB prices) + tax + deliveryFee + serviceFee
```

This diverges from the UI total in multiple ways:
1. **DB subtotal ignores modifier surcharges** — `getVerifiedPrices()` only fetches base `menu_items.price` and branch overrides, but cart items include modifier add-on costs in their `price` field
2. **Cashback discount is never applied** — the UI subtracts cashback, but the backend doesn't know about it
3. **Potential delivery fee mismatch** — while the code correctly zeroes delivery for pickup (`order_type === 'delivery' ? clientDeliveryFee : 0`), the server-side subtotal being wrong means the total is already incorrect

### Fix Strategy

Pass the UI-computed `order_total` to the backend and use it directly as the Stripe charge amount. Keep server-side price verification as a safety check (log a warning if it deviates significantly) but don't override the UI total.

### Changes

**1. `supabase/functions/create-payment-intent/index.ts`**
- Add `order_total` to the request schema (required number field)
- Use `Math.round(order_total * 100)` as the Stripe payment intent amount
- Keep the existing `getVerifiedPrices` call but only use it for metadata (subtotal, items) and a sanity-check log
- Remove the server-side total calculation that overrides the client value

**2. `src/pages/Checkout.tsx`** (useEffect payment intent creation)
- Add `order_total: grandTotal` to the request body (line 438)

**3. `src/components/checkout/CheckoutForm.tsx`** (wallet payment paths)
- Native wallet path (line 472): already passes `orderTotal` to nativeStripePay options — need to verify it reaches the edge function
- Web wallet path (line 517): add `order_total: orderTotal` to the request body

**4. `src/lib/nativeStripePay.ts`** (native wallet payment intent creation)
- Add `order_total: options.orderTotal` to the edge function request body (line 137)

**5. `src/components/checkout/GuestCardPayment.tsx`**
- Accept `orderTotal` prop
- Add `order_total: orderTotal` to the request body (line 137)
- Parent `CheckoutForm.tsx` to pass `orderTotal={orderTotal}` to GuestCardPayment

### No database migration needed.

