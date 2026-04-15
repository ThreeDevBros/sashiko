

## Fix: Guest Credit Card + Apple Pay Selection on Native iOS

### Investigation Results

**Issue 1: Apple Pay selection reverts to Cash**
Root cause is in `Checkout.tsx` conditional rendering. When a user selects Apple Pay in the drawer:
1. `currentPaymentType` changes to `'wallet'` in the parent
2. The parent switches rendering from `<CheckoutForm>` to `<Elements><StripeCheckoutForm></Elements>`
3. This **unmounts** the old component and **mounts** a brand new one
4. The new component initializes with `paymentType = cashAllowed ? 'cash' : 'card'` (line 108 of CheckoutForm.tsx)
5. The `useEffect` on line 134 fires `onPaymentTypeChange('cash')`, which sets parent back to `'cash'`
6. Parent re-renders back to non-Elements `<CheckoutForm>` — Apple Pay is never kept

This affects both guest and authenticated users on the non-clientSecret path (lines 1001-1070 and 1101-1158).

**Issue 2: Guest card payment missing `service_fee`**
`GuestCardPayment.tsx` line 139-148: the `create-payment-intent` call omits `service_fee`, so it defaults to 0. This causes a silent total mismatch when service fees are configured.

### Changes

**1. `src/pages/Checkout.tsx` — Always wrap in Elements to prevent remount**
- For the guest path (lines 1001-1070): Always render inside `<Elements>` using `StripeCheckoutForm`, regardless of `currentPaymentType`. Remove the conditional split between `CheckoutForm` and `StripeCheckoutForm`.
- For the authenticated non-clientSecret path (lines 1101-1158): Same fix — always use `<Elements>` wrapper.
- This prevents the destructive unmount/remount cycle that resets payment type to cash.

**2. `src/components/checkout/GuestCardPayment.tsx` — Add missing `service_fee`**
- Accept `serviceFee` prop
- Pass `service_fee: serviceFee` to the `create-payment-intent` body (line 144)

**3. `src/pages/Checkout.tsx` — Pass `serviceFee` to GuestCardPayment**
- The `<GuestCardPayment>` at line 980 already receives `deliveryFee` and `tax` but not `serviceFee` — add it.

### No database migration needed.

