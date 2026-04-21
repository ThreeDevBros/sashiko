

## Hide Apple Pay on Android Native

### Problem
Apple Pay is currently shown as an option even on native Android devices, where it cannot work. Only Google Pay should appear on Android, and only Apple Pay on iOS.

### Investigation
The wallet option visibility is controlled in the payment method drawer inside `src/components/checkout/CheckoutForm.tsx` (and mirrored in `StripeCheckoutForm` if applicable). The current logic shows "Apple Pay / Google Pay" generically when on a native wallet platform without distinguishing iOS vs Android.

### Changes

**1. `src/components/checkout/CheckoutForm.tsx`**
- Import `Capacitor` from `@capacitor/core`.
- Compute platform-specific flags:
  - `isIOSNative = Capacitor.getPlatform() === 'ios'`
  - `isAndroidNative = Capacitor.getPlatform() === 'android'`
- Replace the single "wallet" option with platform-aware rendering:
  - Show **Apple Pay** label + icon only when `isIOSNative`
  - Show **Google Pay** label + icon only when `isAndroidNative`
  - Hide the wallet option entirely on web (already the case)

**2. `src/components/checkout/GuestCardPayment.tsx`** (if it exposes a wallet button)
- Apply the same platform check so the Apple Pay button is suppressed on Android and vice versa.

**3. `src/lib/nativeStripePay.ts`**
- No logic change needed — already branches on `platform === 'ios'` vs `'android'`. Just ensure callers never invoke Apple Pay path on Android.

### Technical Notes
- Use `Capacitor.getPlatform()` (not `isNativePlatform()`) to distinguish iOS vs Android.
- Label/icon should swap dynamically; the underlying `paymentType = 'wallet'` value stays the same so downstream logic in `nativeWalletPay()` continues to route correctly.

### No database migration needed.

