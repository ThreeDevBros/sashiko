

## Problem

The Xcode logs show the root cause clearly:

```
Payment error: {"message":"Payment Request is not available in this browser.","name":"IntegrationError"}
```

Stripe's web `paymentRequest()` API does **not work** inside Capacitor's WKWebView on iOS. The current code detects native iOS and enables the Apple Pay UI, but when the user taps "Pay with Apple Pay", it still tries to use `stripe.paymentRequest()` — a browser-only API — which immediately fails.

Additionally, auth flows are already native (via `nativeAppleSignIn.ts` and `nativeGoogleSignIn.ts`), so those are fine.

## Solution

Use the `@capacitor-community/stripe` Capacitor plugin to handle Apple Pay natively on iOS (and Google Pay on Android). This plugin provides `createApplePay()` and `presentApplePay()` which invoke the real native Apple Pay sheet, bypassing the WebView limitation entirely.

## Plan

### 1. Install `@capacitor-community/stripe`

Add the npm package. User will need to run `npx cap sync` after pulling.

### 2. Create `src/lib/nativeStripePay.ts`

A helper module (following the same pattern as `nativeAppleSignIn.ts`) that:
- On native iOS: uses `Stripe.initialize()`, `Stripe.createApplePay()`, `Stripe.presentApplePay()` from the Capacitor plugin
- On native Android: uses `Stripe.createGooglePay()`, `Stripe.presentGooglePay()`
- On web: returns `{ supported: false }` so the caller falls back to other methods

The flow:
1. Initialize the plugin with the Stripe publishable key (fetched once)
2. Create a payment intent via the existing `create-payment-intent` edge function
3. Call `createApplePay({ paymentIntentClientSecret, paymentSummaryItems })` 
4. Call `presentApplePay()` to show the native sheet
5. On success, call `confirm-payment` edge function to create the order
6. Navigate to order tracking

### 3. Update `CheckoutForm.tsx` wallet payment branch

In the `handleSubmit` wallet path (lines 409-514), replace the `stripe.paymentRequest()` flow with:

```text
if native platform:
  call nativeStripePay helper → handles entire native wallet flow
else:
  use existing stripe.paymentRequest() web flow (kept for desktop browsers)
```

This means the `!stripe` guard at line 411 won't block native payments anymore — the native path doesn't need the web Stripe instance.

### 4. Update wallet availability detection

In the `useEffect` at line 155, the native detection already sets `availableWallets` correctly. No change needed there. But add a check: only show wallet options on native if the Capacitor Stripe plugin is actually available (graceful degradation).

### 5. Disable wallet button until native plugin is initialized

Pass initialization status through `walletSystemReady`. On native, this should be `true` once the Capacitor Stripe plugin is initialized with the publishable key (not dependent on web Stripe loading).

### 6. Update `Checkout.tsx` stripeReady for native

Currently `stripeReady` is set when `loadStripe()` resolves. For native platforms, set `stripeReady = true` once the Capacitor Stripe plugin is initialized instead, since web Stripe isn't used for wallet payments on native.

### Technical Details

**New dependency:** `@capacitor-community/stripe`

**New file:** `src/lib/nativeStripePay.ts` — Native Apple Pay / Google Pay handler

**Modified files:**
- `src/components/checkout/CheckoutForm.tsx` — Wallet payment branch uses native helper on native platforms
- `src/pages/Checkout.tsx` — Native stripe ready state, independent of web Stripe for wallet

**Post-build user action:** `npx cap sync` to sync the native plugin, then in Xcode:
- Add Apple Pay capability with Merchant ID
- The Merchant ID must be registered in Apple Developer Console and configured in Stripe Dashboard

