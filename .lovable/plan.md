# Enable Apple Sign In on Android & Web (without breaking iOS)

## TL;DR

Keep `com.sashiko.app` exactly where it is (it powers native iOS). **Add** a new Services ID `com.sashiko.app.web` for web + Android. Lovable Cloud accepts both Client IDs in one field as a comma-separated list, so iOS, Android, and Web all work simultaneously.

## Current state

| Platform | How Apple Sign In works | Identifier needed | Status |
|----------|------------------------|-------------------|--------|
| iOS | Native AuthenticationServices SDK | Bundle ID (`com.sashiko.app`) | ✅ working |
| Web | Lovable Cloud OAuth redirect flow | Services ID (web only) | ❌ broken (Bundle ID rejected by Apple for web) |
| Android | Same as web (in-app WebView) | Services ID (web only) | ❌ broken (same reason) |

Apple does not allow a Bundle ID to be used for the web OAuth flow — only Services IDs work there. That's why iOS is the only platform working today.

## Fix (3 phases — you do phases 1 & 2, I do phase 3)

---

### Phase 1 — Apple Developer Console (you, ~5 minutes)

#### 1a. Create the Services ID

1. Go to https://developer.apple.com/account/resources/identifiers/list
2. Click the blue **+** button → select **Services IDs** → Continue
3. Fill in:
   - Description: `Sashiko Web Sign In`
   - Identifier: `com.sashiko.app.web`
4. Continue → Register

(`com.sashiko.app` stays untouched.)

#### 1b. Configure the new Services ID for Sign In with Apple

1. In the Identifiers list, click the new `com.sashiko.app.web`
2. Check the **Sign In with Apple** checkbox → click **Configure**
3. Fill in:
   - **Primary App ID**: `com.sashiko.app` (links iOS and web users to the same Apple account)
   - **Domains and Subdomains** (one per line):
     ```
     sashikoasianfusion.com
     www.sashikoasianfusion.com
     sashiko.lovable.app
     oauth.lovable.app
     ```
   - **Return URLs** — open Lovable Cloud → Auth Settings → Apple → look at the Redirect URL(s) list, click the copy icon next to **each** of the 4 URLs, and paste all 4 here (one per line). They will look like:
     ```
     https://oauth.lovable.app/callback
     https://sashiko.lovable.app/~oauth/callback
     https://www.sashikoasianfusion.com/~oauth/callback
     https://sashikoasianfusion.com/~oauth/callback
     ```
4. Next → Done → Continue → **Save**

---

### Phase 2 — Lovable Cloud Apple settings (you, ~2 minutes)

1. Go to **Cloud → Auth Settings → Sign In Methods → Apple**
2. In the **Client ID** field, change `com.sashiko.app` to:
   ```
   com.sashiko.app.web,com.sashiko.app
   ```
   (web Services ID first, native Bundle ID second, comma-separated, no spaces)
3. Open the **Generate secret** dropdown and fill in:
   - Team ID: `24UN89JR44`
   - Key ID: `697U4B37BZ`
   - Client ID: `com.sashiko.app.web`
   - Private Key (.p8): paste the full contents of your existing `.p8` file (the same one used last time)
4. Copy the generated JWT and paste it into the **Client secret (JWT)** field (replacing the old one)
5. In the **Redirect URL(s)** list, check **all 4 boxes** (currently only the 2 custom-domain ones are checked)
6. **Save**

---

### Phase 3 — Codebase verification (me, after you finish)

Once phases 1 and 2 are done, I'll:

1. **Verify** `src/lib/nativeAppleSignIn.ts` — the iOS branch already passes `clientId: 'app.lovable.6e0c6b4d4b7943e7a8431d08565d9c10'` to the native plugin, which is the legacy Lovable-managed audience. Now that we've moved Apple to BYOC, this needs to be updated to `com.sashiko.app` so the iOS native flow produces tokens that match the Bundle ID we just added to the Client ID list.
2. **Test paths**:
   - iOS native → token `aud = com.sashiko.app` → Lovable Cloud accepts (matches second entry in Client ID list)
   - Web on `sashikoasianfusion.com` → Services ID flow → token `aud = com.sashiko.app.web` → accepted (matches first entry)
   - Android (in-app WebView OAuth) → same as web → accepted
3. **No Android manifest changes needed** — the existing Lovable broker flow returns tokens directly into the WebView; no external browser intent involved.

### File that will change

- `src/lib/nativeAppleSignIn.ts` — single line: replace the legacy Lovable audience string `'app.lovable.6e0c6b4d4b7943e7a8431d08565d9c10'` with `'com.sashiko.app'`

That's the only code change needed. Everything else is configuration.

---

## Why this works

Lovable Cloud (Supabase GoTrue) accepts a comma-separated list in the Apple Client ID field specifically to support apps that have:
- A native iOS Bundle ID identity (for the native sign-in popup)
- A web Services ID identity (for OAuth redirects)

Both produce valid Apple ID tokens; both audiences are explicitly whitelisted. The JWT client secret only needs to be signed against the Services ID — it authenticates Lovable Cloud's server-to-Apple calls, not the user-to-server identity tokens.

## Risks

- If you mistype the Services ID identifier, Apple will silently reject web tokens. Triple-check it's `com.sashiko.app.web`.
- The new JWT expires in 6 months — set a calendar reminder for Oct 2026.
- After phase 2 is saved, **do not test iOS until phase 3 is done**. Between those two steps, iOS sign-in will be broken because the iOS plugin is still sending the legacy Lovable audience. Phase 3 fixes that with one line.

## Order of execution

1. You: Phase 1 (create Services ID in Apple)
2. You: Phase 2 (update Lovable Cloud Apple settings)
3. Tell me when done — I do Phase 3 (1-line code change)
4. You: Build & test — iOS native, Android in-app, Web on custom domain

Reply **approve** when ready and I'll wait for your "phase 1 & 2 done" signal before making the code change.