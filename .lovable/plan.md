I found two real issues in the logs/code:

1. Android Apple OAuth is opening `https://localhost/~oauth/initiate...` inside the Capacitor WebView, so React handles it as an app route and shows the 404 page.
2. Android Google Pay is hidden because the Stripe Capacitor plugin is not available in JS (`Stripe Capacitor plugin not available`). The Android Stripe plugin also expects Google Pay metadata at native load time, including a publishable key in the Android manifest; currently that key is not present, and `MainActivity` only manually registers GoogleAuth.

Plan to fix:

1. Fix Android Apple OAuth flow
   - Change Android Apple sign-in to launch the Lovable Cloud OAuth broker on the production domain instead of local `https://localhost/~oauth/initiate`.
   - Keep redirecting back to the real site/deep-link route so Apple does not reject `localhost`.
   - Add a route/deep-link safety guard so if `/~oauth/...` is ever hit in-app again, it will not render the 404 page.

2. Fix Android Stripe plugin registration
   - Update `MainActivity.java` to manually register the Stripe Capacitor plugin alongside the existing GoogleAuth plugin.
   - Keep the registration before `super.onCreate(...)`, matching Capacitor 7 guidance.

3. Fix Android Google Pay native metadata
   - Add the required `com.getcapacitor.community.stripe.publishable_key` manifest metadata for the Stripe plugin’s Google Pay launcher.
   - Add optional Google Pay metadata defaults so the plugin does not load null values:
     - email required: false
     - phone required: false
     - billing address required: false
     - billing address format: Min
     - existing payment method required: false
   - Keep `google_pay_is_testing=true` as requested for testing.

4. Fix JS plugin access and wallet initialization
   - Stop relying only on `Capacitor.Plugins.Stripe`.
   - Import/register the Stripe plugin through `@capacitor-community/stripe` in `nativeStripePay.ts`, while still using dynamic import so web builds remain safe.
   - Improve Google Pay availability logging so if Google Pay is unavailable, the log says whether it is plugin missing, manifest/config issue, or device/wallet availability issue.

5. Fix browser Google Pay detection and usage
   - Use the app’s actual country/currency instead of the current hardcoded US/USD test check where possible.
   - Make the web wallet check wait for Stripe to be ready and only show Google Pay when Stripe’s Payment Request API confirms it can be used.
   - Keep Google Pay hidden on unsupported browsers/devices; that part is required by Stripe/Google.

6. Manual steps after I implement
   - You will need to pull the changes, then run `npx cap sync android`, rebuild, and reinstall the Android app.
   - For testing mode (`google_pay_is_testing=true`): use a device/emulator with Google Play Services and Google Wallet configured. Google Pay may still be hidden if the emulator/account cannot use Google Pay.
   - Before public release: flip `google_pay_is_testing=false`, use the Stripe live publishable key in the manifest/backend, sign the release build, and make sure that signing certificate/package name are registered/approved for Google Pay.

Technical details:
- Files expected to change:
  - `android/app/src/main/java/com/sashiko/app/MainActivity.java`
  - `android/app/src/main/AndroidManifest.xml`
  - `src/lib/nativeStripePay.ts`
  - `src/lib/nativeAppleSignIn.ts`
  - possibly `src/components/AppRuntimeListeners.tsx` or `src/App.tsx` for OAuth route safety
  - possibly `src/components/checkout/CheckoutForm.tsx` for browser wallet detection polish

No database changes are needed.