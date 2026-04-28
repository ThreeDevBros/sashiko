# Fix: Google Pay missing on Android checkout

## Root cause

`@capacitor-community/stripe` is a hybrid plugin: enabling Google Pay requires **two** Android manifest meta-data tags. We only added one of them (the generic Google Wallet API flag) in the previous fix.

Reading the plugin's source (`MetaData.kt`) shows the plugin reads its own `com.getcapacitor.community.stripe.enable_google_pay` flag from the manifest. If it's missing or `false`, the plugin sets `isAvailable = false` permanently and `isGooglePayAvailable()` **rejects** with "Not implemented on Device" — which is why our probe in `nativeStripePay.ts` falls into the catch branch and the Google Pay button never renders.

This is purely a manifest config issue. The TypeScript wiring, plugin initialization, and UI logic are all correct.

## Plan

### 1. Add the plugin's required meta-data flags to `android/app/src/main/AndroidManifest.xml`

Inside the existing `<application>` block (right next to the `com.google.android.gms.wallet.api.enabled` tag we already added):

```xml
<!-- Enables Google Pay inside the @capacitor-community/stripe plugin -->
<meta-data
    android:name="com.getcapacitor.community.stripe.enable_google_pay"
    android:value="true" />

<!-- Sandbox/test environment until the build is signed with the production cert -->
<meta-data
    android:name="com.getcapacitor.community.stripe.google_pay_is_testing"
    android:value="true" />

<!-- Merchant display name shown in the Google Pay sheet -->
<meta-data
    android:name="com.getcapacitor.community.stripe.merchant_display_name"
    android:value="Sashiko Asian Fusion" />

<!-- Default country (ISO-3166-1 alpha-2) -->
<meta-data
    android:name="com.getcapacitor.community.stripe.country_code"
    android:value="GR" />
```

`google_pay_is_testing=true` is required while running on the emulator / unsigned debug build — Google Pay only reports "ready" in production environment when the APK is signed with the live signing certificate registered in the Google Pay & Wallet Console. Once you ship a signed release build, flip this to `false`.

### 2. No code changes needed

`src/lib/nativeStripePay.ts` and `src/components/checkout/CheckoutForm.tsx` already do the right thing — the probe will start resolving correctly once the manifest flag is in place.

## What you'll need to do after I make the change

1. `npx cap sync android`
2. Rebuild the APK and install on the emulator/device
3. Make sure the test device has Google Wallet installed and at least one card added (the emulator account must be signed into a Google account with a saved card — even a test card works in test mode)

## Production checklist (later, before live launch)

- Switch `google_pay_is_testing` to `false`
- Sign your release APK with the upload key registered in [Google Pay & Wallet Console](https://pay.google.com/business/console)
- Use a Stripe **live** publishable key
