

# Fix: Apple Pay / Google Pay Not Working for Guest Users

## Problem

When a guest user selects Apple Pay or Google Pay on **web**, the payment fails because:

1. The guest checkout renders `CheckoutForm` (not `StripeCheckoutForm`), so the `stripe` prop is always `null`
2. Even when the form is wrapped in `<Elements>` for wallet payments (line 1047-1049), the component doesn't call `useStripe()` — it still receives `stripe={null}`
3. The web wallet path checks `if (!stripe)` and shows "Payment system is not ready"

On **native** (iOS/Android), this isn't an issue because the native path uses the Capacitor Stripe plugin directly and skips the `stripe` object entirely.

## Solution

When guest + wallet is selected, use `StripeCheckoutForm` instead of `CheckoutForm` inside the `<Elements>` wrapper. This ensures `useStripe()` is called and the `stripe` object is available for web wallet payments.

## Changes

### File: `src/pages/Checkout.tsx` (~lines 1015-1051)

Update the guest checkout rendering logic:

- When `currentPaymentType === 'wallet'` and `stripePromise` exists, wrap `StripeCheckoutForm` (not `CheckoutForm`) in `<Elements>` so `useStripe()` provides the stripe instance
- Pass all the same guest-specific props (`isGuest`, `guestInfo`, `guestAddress`, etc.)
- Keep the non-wallet guest path using `CheckoutForm` as-is (cash doesn't need Stripe)

```text
Current flow (broken):
  guest + wallet → <Elements><CheckoutForm stripe={null} /></Elements>

Fixed flow:
  guest + wallet → <Elements><StripeCheckoutForm (calls useStripe internally) /></Elements>
```

This is a single rendering change — no backend or edge function modifications needed.

