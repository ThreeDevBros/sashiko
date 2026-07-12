# Template Candidates — Audit

Tenant-specific values found in the Sashiko codebase that must be parameterized
in the `restaurant-template` project (STEP 3). Grouped by category. Line numbers
are current as of this audit — re-grep before refactoring.

Grep patterns used: `sashiko`, `sashikoasianfusion`, `com.sashiko`,
`support@sashiko`, Lovable project ID `6e0c6b4d…`, Supabase project ref
`cqzprtgcptqusmospdys`.

---

## 1. Native identifiers (bundle IDs, app name, URL scheme)

Must be unique per client — App Store & Play Store enforce this.

- `capacitor.config.ts:4` — `appId: 'com.sashiko.app'` → `clientConfig.native.appId`
- `capacitor.config.ts:5` — `appName: 'Sashiko Asian Fusion'` → `clientConfig.native.appName`
- `setup/swift/OrderTrackingWidgetLiveActivity.swift:54,132` — `sashiko://order-tracking/…` URL scheme (Swift, edited outside Lovable — document in TEMPLATE.md)
- `src/lib/nativeStripePay.ts:246,320,339` — `merchant.sashiko.app` Apple Pay merchant ID → per-client
- `supabase/functions/update-order-eta/index.ts:77` — fallback `'com.sashiko.app'` for `IOS_BUNDLE_ID` env → set env per client, remove hardcoded fallback
- `supabase/functions/send-order-push/index.ts:160` — same fallback pattern

## 2. Production web domain

- `src/lib/nativeAppleSignIn.ts:20,24` — hardcoded `https://sashikoasianfusion.com` for Android OAuth broker → `clientConfig.web.productionDomain`
- `src/pages/admin/QRCodeMenu.tsx:57` — QR menu URL `https://sashikoasianfusion.com/qr-menu/…` → derive from `clientConfig.web.productionDomain`
- `supabase/functions/auth-email-hook/index.ts:40-44` — `SENDER_DOMAIN`, `ROOT_DOMAIN`, `FROM_DOMAIN`, `SAMPLE_PROJECT_URL` all Sashiko → env vars per client

## 3. Brand strings (name, tagline, marketing copy)

Most already fall back through `branding?.tenant_name` (DB-driven), which is
good. The hardcoded fallbacks below should read from `clientConfig.brand.name`
instead of the string `'Sashiko'`.

- `src/constants/index.ts:5-6` — `DEFAULT_RESTAURANT_NAME`, `DEFAULT_HERO_TITLE`
- `src/lib/theme.ts:184-185` — `tenant_name`, `hero_title` defaults
- `src/pages/Index.tsx:318` — footer fallback `'Sashiko'`
- `src/pages/Auth.tsx:579-580, 653-654, 945` — logo alt and footer fallback
- `src/pages/Profile.tsx:449` — footer fallback
- `src/pages/AccountDeletionInfo.tsx:12` — tenantName fallback
- `src/pages/LegalPage.tsx:15` — tenantName fallback
- `src/pages/Support.tsx:75` — **hardcoded** `Sashiko Asian Fusion © …` (no fallback) — must be replaced
- `src/components/Sidebar.tsx:37,39` — hardcoded alt text + heading
- `src/pages/admin/CustomerManagement.tsx:349` — hardcoded label `"Sashiko Wallet"` → generic "Wallet" or `${brand} Wallet`

## 4. Logo assets

Bundled PNGs, imported from `@/assets/sashiko-logo*.png`. Template should
either ship a placeholder logo or read from DB branding only.

- `src/pages/DriverDashboard.tsx:7`
- `src/pages/CheckoutSuccess.tsx:11`
- `src/pages/Auth.tsx:29`
- `src/components/Sidebar.tsx:12`

Also referenced as absolute URLs in edge function email templates (see §7).

## 5. SEO / PWA metadata

- `index.html:26-49` — title, description, keywords, og:*, twitter:*, og:image (absolute URL to Sashiko storage bucket)
- `vite.config.ts:18-20` — PWA manifest `name`, `short_name`, `description`

Template should generate these from `clientConfig.brand.*` at build time
(Vite plugin or `index.html` templating).

## 6. i18n copy

- `src/i18n/locales/en.json:242` — `"sashikoPoints": "Sashiko Points"`
- `src/i18n/locales/el.json:242` — same in Greek
- `src/pages/Profile.tsx:263` — uses `t('profile.sashikoPoints')`

Rename key to `loyaltyPoints` (or similar) in template; template `.json` can
substitute `{{brand}}` at build time.

## 7. Edge function email templates (hardcoded brand + logo URL)

All templates hardcode a logo URL pointing at Sashiko's own storage bucket
(`https://rfwqbzeutrfccaazvibc.supabase.co/storage/v1/object/public/restaurant-images/email/sashiko-logo.png`).
Template should read logo URL + brand name from env vars / DB settings.

- `supabase/functions/send-order-email/index.ts:60,87`
- `supabase/functions/send-reservation-email/index.ts:59,75`
- `supabase/functions/send-broadcast-notification/index.ts:80,96`
- `supabase/functions/_shared/email-templates/signup.tsx:33,37-47`
- `supabase/functions/_shared/email-templates/recovery.tsx:28,32-35`
- `supabase/functions/_shared/email-templates/reauthentication.tsx:23,27-30`
- `supabase/functions/_shared/email-templates/magic-link.tsx:28,32-*`
- `supabase/functions/auth-email-hook/index.ts:39` — `SITE_NAME`

## 8. Lovable project ID (Apple Sign In native)

Native Apple Sign In on iOS uses the Lovable-managed OAuth client ID, which is
derived from the Lovable project ID. Each forked project has its own — the
template must read this at build time (e.g. from an env var written by the
provisioning runbook).

- `src/lib/nativeAppleSignIn.ts:70,72` — hardcoded `app.lovable.6e0c6b4d4b7943e7a8431d08565d9c10`
- `setup/SETUP.md:46` — documents the same bundle ID for iOS setup

## 9. Supabase project ref

- `supabase/config.toml:1` — `project_id = "cqzprtgcptqusmospdys"` — auto-generated per project, no action needed; new project gets a new ref automatically.

## 10. Local storage keys

- `src/components/ThemeProvider.tsx:15` — `STORAGE_KEY = "sashiko-theme"` → rename to something generic like `"app-theme"` in template

## 11. Seed data (safe to leave)

- `supabase/migrations/20260307193304_*.sql:33,68` — seed menu item named "Sashiko Roll". Migrations shouldn't run on a fresh template DB; strip Sashiko-specific seeds before forking.

---

## Google Maps setup — CURRENT STATE

- Loader (`src/lib/googleMaps.ts`) fetches the browser key at runtime from
  edge function `get-public-keys` which reads the `GOOGLE_MAPS_API_KEY`
  Supabase secret. This is **already a per-project secret**, not the Lovable
  managed connector — so Sashiko has its own key in Google Cloud (referrer-
  restricted to `sashikoasianfusion.com`).
- Template just needs a placeholder in the provisioning runbook: "create a
  Google Cloud project, enable Maps JS + Places + Geocoding, create a
  browser key restricted to the client's domain, paste as
  `GOOGLE_MAPS_API_KEY` secret."
- No code change needed for Maps — the loader is already tenant-agnostic.

---

## Actions to take in STEP 3 (template refactor)

1. Introduce `client.config.ts` with `brand`, `native`, `web`, `features` blocks.
2. Replace every string hit above with a `clientConfig.*` read.
3. Build-time templating for `index.html` and `vite.config.ts` (PWA manifest).
4. Strip Sashiko seed rows from migrations before forking.
5. Rename `"sashiko-theme"` storage key and `"sashikoPoints"` i18n key.
6. Document Google Cloud / Apple Merchant ID / Apple Sign In client ID setup in `docs/TEMPLATE.md` — these are configured **outside** Lovable per client.
7. Remove hardcoded `com.sashiko.app` fallbacks in edge functions; require env vars.
