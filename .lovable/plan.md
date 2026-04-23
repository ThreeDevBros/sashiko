
## Show Apple Pay vs Google Pay Based on Platform/OS

### Current State
Native platforms already work correctly:
- Native iOS → Apple Pay only ✓
- Native Android → Google Pay only ✓

On web, the code relies on Stripe's `canMakePayment()`, which can return both wallets as available on some browsers (e.g., Chrome on macOS with both configured), letting Apple Pay slip onto non-Apple platforms or vice versa.

### Goal
Force OS/browser-aware wallet selection on web:
- macOS + Safari → Apple Pay only
- iOS web browser → Apple Pay only
- Windows / Linux / Android web browser → Google Pay only
- Mac + non-Safari (Chrome/Firefox) → Google Pay only (Apple Pay requires Safari anyway)

### Changes

**1. `src/components/checkout/CheckoutForm.tsx` — wallet detection effect (lines ~151-200)**

Add a helper that classifies the host OS/browser, then filter Stripe's `canMakePayment()` result accordingly:

```ts
function detectHostPlatform() {
  const ua = navigator.userAgent;
  const isIOSWeb = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isMac = /Macintosh|Mac OS X/.test(ua) && !isIOSWeb;
  const isAndroidWeb = /Android/.test(ua);
  const isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua);
  // Apple Pay only viable on Apple devices using Safari (or iOS WebKit)
  const allowApplePay = isIOSWeb || (isMac && isSafari);
  // Google Pay viable on everything else with a Chromium-based browser, plus Android
  const allowGooglePay = !allowApplePay;
  return { allowApplePay, allowGooglePay };
}
```

Inside the existing web branch (after Stripe's `canMakePayment` resolves), intersect Stripe's result with this host policy:

```ts
const host = detectHostPlatform();
setAvailableWallets({
  applePay: !!canMakePayment?.applePay && host.allowApplePay,
  googlePay: !!canMakePayment?.googlePay && host.allowGooglePay,
});
```

**2. Wallet labelling in payment drawer**

Existing logic already labels the wallet button based on `availableWallets.applePay` vs `googlePay`. With the filtered flags above, only the correct wallet label/icon will render — no further UI change needed.

### Notes
- Stripe's `canMakePayment` is still the source of truth for whether the wallet is actually configured on the device. We only narrow it down to the platform-appropriate one.
- If a user is on Mac+Chrome and has Apple Pay configured, we intentionally hide it (per requirement: only Mac+Safari shows Apple Pay).
- If `canMakePayment` returns nothing (user has no wallet set up), no wallet shows — same as today.
- No native code changes required; native iOS/Android branches already enforce the correct wallet.
