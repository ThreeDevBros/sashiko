

## Problem

When a user selects "Pay with Apple Pay" and taps the submit button, the form handler hits `if (!stripe) { setError('Payment system is not ready...') }` because:

1. **Guest users**: The `CheckoutForm` is rendered *without* the `<Elements>` wrapper, so `useStripe()` returns `null`.
2. **Logged-in users before clientSecret loads**: Same issue — the non-Elements fallback renders while Stripe initializes.
3. **Native iOS wallet**: Wallet is force-enabled via Capacitor platform detection, but the actual Stripe `paymentRequest` API still needs a Stripe instance to process payment.

The core issue is that **wallet payments on native iOS need Stripe initialized**, but the form doesn't have access to it when rendered outside `<Elements>`. Additionally, the button should be disabled when Stripe isn't ready, preventing the "system not ready" error.

## Plan

### 1. Disable the submit button when wallet is selected but Stripe isn't ready

In `Checkout.tsx`, add a condition to the button's `disabled` and opacity logic: when `currentPaymentType === 'wallet'` and `stripePromise` hasn't resolved (or `clientSecret` isn't available for logged-in users), disable the button. This prevents the user from tapping before the system is ready.

### 2. Ensure Stripe is loaded for wallet payments (guest path)

For guest users who select wallet, Stripe needs to be initialized. Currently, `stripePromise` loads when `currentPaymentType` is `card` or `wallet` — this is correct. But the guest `CheckoutForm` is rendered **outside** `<Elements>`, so `useStripe()` returns null.

**Solution**: When a guest selects wallet payment and `stripePromise` is available, wrap the guest `CheckoutForm` in `<Elements>` (using a minimal options config without `clientSecret`, since wallet payments use `paymentRequest` not `PaymentElement`). Alternatively, pass the resolved Stripe instance as a prop.

The simpler approach: In `Checkout.tsx`, when `isGuest && currentPaymentType === 'wallet' && stripePromise`, render the guest form inside `<Elements stripe={stripePromise}>` so `useStripe()` works.

### 3. Handle the wallet payment flow in handleSubmit

The current `handleSubmit` goes to the Stripe card payment path for non-cash. For wallet payments, it needs to use `stripe.paymentRequest()` to trigger the native Apple Pay sheet. This requires:
- Creating a `paymentRequest` with the correct total amount
- Calling `.show()` to present the Apple Pay sheet
- Handling the `paymentmethod` event to confirm payment via the `create-payment-intent` edge function

### Technical Details

**Files to modify:**

- **`src/pages/Checkout.tsx`**:
  - Add `stripeReady` state that resolves when `stripePromise` is loaded
  - Disable submit button when `currentPaymentType === 'wallet' && !stripeReady`
  - Wrap guest form in `<Elements>` when wallet is selected and stripePromise is available

- **`src/components/checkout/CheckoutForm.tsx`**:
  - Add a dedicated wallet payment branch in `handleSubmit` that uses `stripe.paymentRequest()` to invoke native Apple Pay/Google Pay
  - Create the payment intent server-side, then confirm via the native wallet sheet
  - Pass order total as a prop so the paymentRequest has the correct amount

