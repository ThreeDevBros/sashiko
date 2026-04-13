

## Plan: Secure Account Deletion Flow

### What changes

**1. Replace "Delete Account" button with "Proceed to Account Deletion"**
- In the Account Settings section of `src/pages/Profile.tsx`, replace the current `AlertDialog`-based delete button with a red "Proceed to Account Deletion" button that navigates to a new dedicated page.

**2. Create new Account Deletion page (`src/pages/AccountDeletion.tsx`)**
- Full-page form requiring the user to enter:
  - **Email** — validated against `user.email`
  - **Phone number** — validated against the profile's saved phone
  - **Password** — validated via `supabase.auth.signInWithPassword()` (re-authentication check)
- Real-time field validation: each field shows a green checkmark or red error as the user types
- The **"Delete My Account"** button stays greyed out / disabled until all three fields match
- On press, a bottom sheet / drawer slides up with a **WARNING**:
  - "All your personal information, credit points, reward balance, order history, and booking history will be permanently deleted and cannot be recovered."
  - Two buttons: **"Delete My Account"** (red/destructive) and **"Go Back"** (outline)
- If confirmed, calls the existing `delete-account` edge function, signs out, and redirects to `/auth`

**3. Add route in `src/App.tsx`**
- Add `/account/delete` route pointing to the new page (protected, requires auth)

**4. Update edge function `supabase/functions/delete-account/index.ts`**
- Before deleting the auth user, cascade-delete related data: `profiles`, `user_addresses`, `orders`, `order_items`, `reservations`, `cashback_transactions`, `user_roles`, `user_permissions`, `push_devices`, `saved_cards` — all rows matching the user ID
- This ensures complete data removal from the system

### Technical details

- Password verification: call `supabase.auth.signInWithPassword({ email, password })` on the client to confirm credentials match before enabling the delete button. This does not create a new session if the user is already logged in.
- The warning uses the `Drawer` component (bottom sheet) for mobile-friendly slide-up UX
- No new i18n keys will be added for now (hardcoded English strings); can be internationalized later

### Files to create/modify
- `src/pages/AccountDeletion.tsx` — new page
- `src/pages/Profile.tsx` — replace delete button with navigation button
- `src/App.tsx` — add route
- `supabase/functions/delete-account/index.ts` — add cascade data deletion

