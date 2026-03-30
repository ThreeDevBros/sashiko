

## Problem Analysis

Three issues identified:

1. **Apple Pay not available for guest users**: Line 157 in `CheckoutForm.tsx` has `if (isGuest) return;` in the wallet detection `useEffect`, which skips wallet detection entirely for guests. Apple Pay/Google Pay options never appear for guests.

2. **Apple Pay icon shows generic `Smartphone` icon**: The Apple Pay and Google Pay buttons use `<Smartphone>` instead of proper brand icons (Apple logo / Google Pay logo).

3. **"Pay Now" button doesn't change to "Pay with Apple Pay"**: The button text in `Checkout.tsx` only differentiates between `cash` ("Place Order") and non-cash ("Pay Now"). It doesn't show "Pay with Apple Pay" or "Pay with Google Pay" when wallet is selected.

## Plan

### 1. Enable wallet detection for guest users
In `CheckoutForm.tsx`, remove the `if (isGuest) return;` guard from the wallet detection `useEffect` (line 157). Also show the "Digital Wallets" section in the payment drawer for guests (line 640 has `!isGuest &&` guard).

### 2. Add Apple Pay and Google Pay SVG icons
Create a small component or inline SVG for the Apple logo and Google Pay logo. Replace all `<Smartphone>` icons in the wallet buttons (drawer trigger, drawer options) with the appropriate brand icon.

### 3. Dynamic button text for wallet payments
In `Checkout.tsx`, update the `setButtonText` calls (lines 1000, 1032, 1064) and the button rendering (line 1279) to show:
- `cash` → "Place Order"
- `wallet` → "Pay with Apple Pay" / "Pay with Google Pay"  
- `card` → "Pay Now"

### 4. Handle wallet payment submission for guests
When a guest selects Apple Pay/Google Pay and taps the submit button, the flow currently goes to `form.requestSubmit()` which triggers the `CheckoutForm.handleSubmit`. The wallet payment path in `handleSubmit` uses Stripe's `paymentRequest` API which requires `stripe` — for guests, Stripe may not be initialized since they don't have an `Elements` wrapper. Need to ensure Stripe is loaded when wallet is selected (similar to card payment initialization) and that the `paymentRequest` flow works for guests.

### Technical Details

**Files to modify:**
- `src/components/checkout/CheckoutForm.tsx` — Remove guest guard from wallet detection, show wallet options for guests, add Apple/Google Pay icons
- `src/pages/Checkout.tsx` — Update button text logic for wallet type, load Stripe when wallet is selected

**New file:**
- `src/components/icons/ApplePayIcon.tsx` — SVG icon components for Apple Pay and Google Pay marks

