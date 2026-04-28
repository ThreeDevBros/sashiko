## Google Pay on Android — what's required

You asked whether Google Pay needs anything special. Short answer: **yes, two things are missing**, and one of them is the actual cause of the bug.

### 1. Required Android manifest meta-data (MISSING — this is the bug)

The Capacitor Stripe plugin's Google Pay support requires this tag inside `<application>` in `android/app/src/main/AndroidManifest.xml`:

```xml
<meta-data
    android:name="com.google.android.gms.wallet.api.enabled"
    android:value="true" />
```

Without it, when you tap the Google Pay button:
- The plugin's `isGooglePayAvailable()` / `createGooglePay()` call fails immediately on the native side.
- The wallet sheet never opens.
- The selection visually "snaps back" to the previous payment method because the user perceives nothing happened (the UI does flip to wallet, but on tapping "Pay" it errors and we surface a message). In your screenshot the red banner appearing right under "Payment Method" is exactly this kind of native-side failure being surfaced as an error.

This is the standard Google Pay enablement flag — every Android app that uses Google Pay must declare it. It's documented by Google and by the @capacitor-community/stripe plugin.

### 2. Google Cloud Console / Google Pay Business Console — what you actually need

Good news: **you do NOT need to set up your own Google Pay merchant account, get a merchant ID, or configure anything in Google Cloud Console** in order to *test* Google Pay. Stripe acts as the Google Pay payment processor — Stripe's gateway ID and your Stripe account ID are what get sent to Google, and the plugin handles that automatically using your Stripe publishable key.

What you do need:

- **Stripe publishable key** — already configured (`STRIPE_PUBLISHABLE_KEY` secret, fetched via the `get-public-keys` edge function). ✅
- **A test card in Google Wallet on the device** — for testing in TEST mode (Stripe test publishable key `pk_test_...`), the device just needs Google Wallet installed and any card added. Stripe automatically uses Google Pay's TEST environment when your publishable key is a test key.
- **For production (live payments):**
  - Use a **live** Stripe publishable key (`pk_live_...`). The plugin auto-switches Google Pay to PRODUCTION environment based on the key.
  - The Android app must be **signed with the release keystore** (already configured) and **uploaded to the Google Play Console** (even as an internal/closed test track) so Google can verify the app's signing certificate. Google Pay will refuse to show real cards in a debug-signed APK in production mode.
  - No separate Google Pay merchant onboarding is required — Stripe's merchant agreement covers it.

So: no new keys, no Google Cloud Console project, no Google Pay Business Console account. Just the manifest tag + (for live) a Play-uploaded signed build.

### 3. (Optional polish) — handle init failures gracefully

Right now in `src/lib/nativeStripePay.ts`, if `initializeNativeStripe()` fails on Android (which it does today because of the missing meta-data), the wallet button still renders as available because `availableWallets.googlePay` is hardcoded `true` for all Android devices in `CheckoutForm.tsx`. We should:

- Try to call the plugin's `isGooglePayAvailable` after init and gate the wallet button on the actual result.
- If init/availability fails, hide the Google Pay option instead of letting the user select something that will error out.

This makes the deselection bug impossible going forward.

---

## Plan

### Files to change

**1. `android/app/src/main/AndroidManifest.xml`**
Add the Google Pay enablement meta-data inside `<application>`:
```xml
<meta-data
    android:name="com.google.android.gms.wallet.api.enabled"
    android:value="true" />
```

**2. `src/lib/nativeStripePay.ts`**
Add an `isGooglePayAvailable()` helper that:
- Returns `false` if the plugin isn't available or init failed.
- On Android, calls `StripePlugin.isGooglePayAvailable()` and returns the boolean result.
- On iOS, calls `StripePlugin.isApplePayAvailable()`.
- Caches the result so we don't ping the plugin repeatedly.

**3. `src/components/checkout/CheckoutForm.tsx`**
Replace the hardcoded native wallet detection (lines 154–170) with a real availability check:
- On native iOS/Android, call the new `isGooglePayAvailable()` / `isApplePayAvailable()` from `nativeStripePay.ts` after Stripe init resolves.
- Only set `availableWallets.googlePay = true` if the device actually reports Google Pay is ready.
- If unavailable, hide the wallet button entirely (matching the current web behavior).

This is the defensive fix — once the manifest tag is added, this also ensures users on devices without Google Wallet (rare, but possible) don't see a broken button.

### What to do after the code change

1. Rebuild the Android app (`npx cap sync android` then build in Android Studio or via gradle).
2. Install on your device. Google Wallet must be installed with at least one card (test card is fine in TEST mode).
3. Go to checkout → Payment Method → tap Google Pay → the native Google Pay sheet should now open.

### What this won't fix

- The **"Authentication session expired"** red banner in your screenshot is a separate condition — it appears when an edge function call (e.g. `get-public-keys` or `create-payment-intent`) returns an auth error. After the Google Pay fix, if you still see that banner specifically, it's an auth/session issue and we'll debug separately.
