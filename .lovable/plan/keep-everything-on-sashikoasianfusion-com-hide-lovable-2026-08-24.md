# Keep everything on sashikoasianfusion.com, hide Lovable

## 1. Why the old 6-digit screen still shows

The code no longer has the 6-digit code screen — signup already uses the "check your email" notice. The URL you tested (`preview--sashiko.lovable.app`) is a **static snapshot of the last publish**, not the live editor preview, so reloading it can't pick up newer code. Nothing to fix in code: republish the app and that screen disappears.

## 2. Verify button lands on Lovable

Two causes, both fixable:

- On web, signup sets the email's return address to whatever origin you were on — so signing up from `preview--sashiko.lovable.app` sends the email back to that Lovable URL.
- The backend's default Site URL is `https://sashiko.lovable.app`, which is used as fallback for any auth email link.

Changes:
- Introduce one canonical public site URL (`https://sashikoasianfusion.com`) in a small config module and use it for every auth email redirect (signup confirm, resend, password reset, magic link) — native and web alike, no more `window.location.origin`.
- Update the backend auth Site URL to `https://sashikoasianfusion.com` so all fallback links use your domain. Your domain is already on the redirect allow-list.
- Keep the `?src=app` / `?src=web` flag so the confirmation page still deep-links back into the native app.

Note: the custom domain is currently not connected to this project (checked — no custom domains). Reconnect it in Project Settings > Domains, otherwise these links will 404 until it's live. I'll implement against the domain regardless.

## 3. Remove visible Lovable references

- Audit user-visible strings, links, page metadata and email templates for any "Lovable" mention and replace with Sashiko / your domain.
- Auth emails: sender and links stay on `notify.sashikoasianfusion.com` / `sashikoasianfusion.com` (already correct) — verify all six templates after the URL change.
- Sign-in with Google/Apple: you said your own Service ID / client credentials are configured. The app still calls the managed sign-in broker, and the native Apple path sends the client ID `app.lovable.6e0c6b4d…`. I will check what the provider settings actually hold and, if your own Apple Services ID is configured there, switch the native call to use it so no Lovable identifier is visible on the Apple consent screen. If the backend still holds the managed identifier, I'll tell you exactly what to change rather than guess.
- Internal-only mentions (npm package names, backend integration folder) stay — they never render to users and removing them would break sign-in.

## Technical notes

- New `src/config/site.ts` exporting `SITE_URL` and a helper for auth redirect URLs.
- `src/pages/Auth.tsx`: signup + resend + password reset use the helper instead of `window.location.origin`.
- `src/components/auth/EmailSentNotice.tsx`: resend uses the same helper.
- Backend auth settings: Site URL updated to the custom domain.
- Verify the six templates in `supabase/functions/_shared/email-templates/` and redeploy `auth-email-hook` if any change.
