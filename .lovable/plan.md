

# Everything You Need to Do for Sashiko Asian Fusion

This is a complete checklist of manual setup tasks required for every feature to work on **Web, iOS, and Android**.

---

## 1. Google OAuth (Sign in with Google)

Since you removed the Lovable managed auth and are using `supabase.auth.signInWithOAuth` directly, you need to configure Google OAuth yourself:

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Credentials
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add these **Authorized redirect URLs**:
   - `https://cqzprtgcptqusmospdys.supabase.co/auth/v1/callback`
4. Copy the **Client ID** and **Client Secret**
5. In your Lovable Cloud dashboard (Users → Auth Settings → Google), paste both values

Without this, the "Sign in with Google" button will fail.

---

## 2. Apple OAuth (Sign in with Apple)

1. Go to [Apple Developer Console](https://developer.apple.com)
2. Create an **App ID** with "Sign in with Apple" enabled
3. Create a **Services ID** for web sign-in
4. Add the redirect URL: `https://cqzprtgcptqusmospdys.supabase.co/auth/v1/callback`
5. Generate a **Key** for Sign in with Apple
6. In your Lovable Cloud dashboard (Users → Auth Settings → Apple), enter the Service ID, Team ID, Key ID, and private key

Without this, the "Sign in with Apple" button will fail.

---

## 3. Google Maps API Key

Your key is already stored. Verify in [Google Cloud Console](https://console.cloud.google.com):

- **Enable these 4 APIs** for your key:
  1. Maps JavaScript API
  2. Places API
  3. Geocoding API
  4. Directions API
- **Restrictions**: Either set to "None" (unrestricted) or add your domains AND native app bundle IDs. If you have HTTP referrer restrictions, native WebViews will be blocked.

**Affects**: Delivery maps, address search, driver tracking, branch location display, delivery time/fee estimates, Google Reviews import.

---

## 4. Stripe (Payments)

You said to skip Stripe, but for completeness — your keys are already stored. Ensure:
- The **Publishable Key** and **Secret Key** match the same Stripe account
- Webhook endpoint is configured in Stripe Dashboard pointing to your `stripe-webhook` edge function
- For Apple Pay / Google Pay to work in native apps, you need to register your domain with Stripe

---

## 5. Push Notifications (FCM)

**Status: NOT working** — `FCM_SERVER_KEY` is missing.

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a project (or use existing)
3. Add an **iOS app** with bundle ID: `com.sashiko.app`
4. Add an **Android app** with package name: `com.sashiko.app`
5. Download:
   - `google-services.json` → place in `android/app/`
   - `GoogleService-Info.plist` → place in `ios/App/App/`
6. Go to Project Settings → Cloud Messaging → Get the **Server Key** (legacy) or set up FCM v1
7. Give me the key and I'll store it as `FCM_SERVER_KEY`

**Affects**: Push notifications to mobile devices (new orders for staff, order status updates for customers, broadcast notifications).

---

## 6. Email Infrastructure

**Status: Working** — domain `notify.sashikoasianfusion.com` is configured.

**You need to verify**: In your domain registrar (where you manage `sashikoasianfusion.com`), ensure the DNS records (SPF, DKIM, DMARC) are properly set. You can check this in the Lovable Cloud email settings.

**Affects**: Signup verification emails, password reset emails, order receipts, reservation confirmations, broadcast emails.

---

## 7. Native App Build (iOS & Android)

To run on physical devices:

1. Export project to GitHub via the "Export to GitHub" button
2. `git clone` your repo locally
3. `npm install`
4. `npx cap add ios` and/or `npx cap add android`
5. Add Firebase config files (step 5 above)
6. `npm run build`
7. `npx cap sync`
8. `npx cap run ios` (requires Mac + Xcode) or `npx cap run android` (requires Android Studio)

**iOS-specific**:
- In `ios/App/App/Info.plist`, ensure `NSLocationWhenInUseUsageDescription` is set (Capacitor usually adds it)
- For App Store submission, you need an Apple Developer account ($99/year)

**Android-specific**:
- In `android/app/src/main/AndroidManifest.xml`, ensure `ACCESS_FINE_LOCATION` permission exists
- For Play Store submission, you need a Google Play Developer account ($25 one-time)

---

## 8. Capacitor Config Update

**Current issue**: `appName` is "Sashiko" but you want "Sashiko Asian Fusion". I will update this during implementation.

---

## Quick Reference Summary

| Feature | What You Need | Status |
|---------|--------------|--------|
| Email/Password auth | Nothing — works out of the box | ✅ Ready |
| Google Sign-in | Configure OAuth in Google Cloud + Cloud Auth Settings | ❌ Setup needed |
| Apple Sign-in | Configure in Apple Developer + Cloud Auth Settings | ❌ Setup needed |
| Google Maps | Enable 4 APIs, check restrictions | ⚠️ Verify |
| Stripe payments | Already configured | ✅ Ready |
| Push notifications | Firebase project + FCM key | ❌ Setup needed |
| Email sending | Verify DNS records | ⚠️ Verify |
| Menu image generation | Uses managed AI — no setup needed | ✅ Ready |
| Geolocation | Works on web; native needs permissions (auto-added by Capacitor) | ✅ Ready |
| Haptics | Works automatically on native, silent on web | ✅ Ready |
| File uploads (images) | Storage bucket exists and is public | ✅ Ready |

---

## What I Will Do

1. Update `capacitor.config.ts` to set `appName` to `Sashiko Asian Fusion`
2. Store `FCM_SERVER_KEY` once you provide it

Everything else requires manual configuration in external dashboards (Google Cloud, Apple Developer, Firebase).

