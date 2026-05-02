# Fill in Missing Information for OAuth Sign-Ins

## Goal

When a user signs in with Google or Apple **for the first time**, automatically save everything the provider gave us (full name, email, avatar) onto their profile. Then, if any of the three mandatory fields — **Full Name, Phone, Email** — is still missing, show a single non-dismissible popup titled **"Fill in Missing Information"** that pre-fills what we already have and forces the user to complete what's missing before continuing.

## What providers actually give us

| Field | Google | Apple |
|---|---|---|
| Full name | Always | Only on the very first sign-in (and only if the user keeps "Share My Name") |
| Email | Always | Always (sometimes a `@privaterelay.appleid.com` alias) |
| Phone | Never | Never |

So phone is always missing for OAuth, name is sometimes missing for Apple, and email is always available but currently isn't copied into our `profiles` table.

## Changes

### 1. Database — extend the new-user trigger

Update `public.handle_new_user()` so that on every new auth user it copies into `profiles`:
- `full_name` from `raw_user_meta_data.full_name` / `name` / `given_name + family_name`
- `phone` from `raw_user_meta_data.phone` (covers our email signup which already passes this)
- `email` from `NEW.email` (new column on `profiles`)
- `avatar_url` from `raw_user_meta_data.avatar_url` / `picture` (new column on `profiles`)

Add `email text` and `avatar_url text` columns to `profiles` if not present. `email` mirrors `auth.users.email` so the UI doesn't need a second query.

### 2. Replace `PhonePromptDialog` with `CompleteProfileDialog`

New component `src/components/CompleteProfileDialog.tsx`:

- Mounts globally (replaces `PhonePromptDialog` in `src/App.tsx`).
- Triggers when `user.app_metadata.provider` is `google` or `apple` AND the profile is missing **any** of: `full_name`, `phone`, `email`.
- Title: **"Fill in Missing Information"** (i18n key `auth.fillMissingInfo`).
- Description explains that some details couldn't be retrieved from Google/Apple.
- Renders 3 fields: Full Name, Phone, Email.
  - Fields the provider supplied are **pre-filled and read-only** (with a small "from Google" / "from Apple" hint).
  - Missing fields are empty, required, and focused in order.
- Non-dismissible: blocks outside-click and Escape, no close button. The user cannot proceed until all three are valid.
- Save button writes the full row to `profiles` (full_name, phone, email) via a single `update`.
- After save, the dialog closes and the user lands wherever they were (e.g. `/profile`).

Validation: name ≥ 2 chars, phone ≥ 6 digits, email matches standard regex.

### 3. Profile page email source

`Profile.tsx` already shows email from the auth session — keep that, but also keep the new `profiles.email` column in sync so other parts of the app (orders, exports) can read it without joining `auth.users`.

### 4. Memory

Update `mem://features/oauth-onboarding-flow` to record the new mandatory-three-field dialog in place of the phone-only one.

## Technical details

- Trigger update is idempotent (`CREATE OR REPLACE FUNCTION`); existing users are unaffected because the trigger only fires on insert. Existing OAuth users with a missing phone will still get the dialog on next login because the check is on the `profiles` row, not on auth metadata.
- Backfill once via migration: `UPDATE profiles SET email = u.email, avatar_url = COALESCE(profiles.avatar_url, u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture') FROM auth.users u WHERE profiles.id = u.id AND profiles.email IS NULL;`
- The dialog uses the existing `Dialog` primitive with `onPointerDownOutside={e => e.preventDefault()}` and `onEscapeKeyDown={e => e.preventDefault()}` — same pattern as today's `PhonePromptDialog`.
- Pre-fill source on the client: read `user.user_metadata` (`full_name`, `name`, `given_name`/`family_name`) and `user.email` to know which fields were provider-supplied vs missing. The `profiles` row is the source of truth for "do we still need to ask?".
- No edge function needed — all writes go through RLS-protected `profiles` update by the user themselves.
- `PhonePromptDialog.tsx` and its mount in `App.tsx` are removed.

## Files touched

- `supabase/migrations/<new>.sql` — add `email`, `avatar_url` columns, update `handle_new_user`, backfill.
- `src/components/CompleteProfileDialog.tsx` — new.
- `src/components/PhonePromptDialog.tsx` — deleted.
- `src/App.tsx` — swap component import + mount.
- `src/i18n/locales/en.json` and `el.json` — new strings (`auth.fillMissingInfo`, description, "from Google", "from Apple", per-field hints).
- `mem://features/oauth-onboarding-flow` — updated rule.
