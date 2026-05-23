## Goal
When any sign-in method fails (email/password, Google, Apple, signup, password reset), show the user a clear, specific message on screen instead of generic "Something went wrong" / silent failures.

## Approach
All sign-in handlers already live in `src/pages/Auth.tsx` and use `toast.error()` from `sonner`. The current toasts are either generic or just dump `error.message`. I'll:

1. Add a small `getAuthErrorMessage(error)` helper at the top of `Auth.tsx` that maps known patterns to friendly strings:
   - Network / connectivity → "No internet connection. Please check your network and try again."
   - User cancelled (code `12501`, `-5`, "canceled") → no toast (silent, expected)
   - Invalid login credentials → "Incorrect email or password."
   - Email not confirmed → "Please verify your email before signing in."
   - Already registered → existing i18n string
   - Rate limit / "too many requests" → "Too many attempts. Please wait a moment and try again."
   - Google plugin code `7` (NETWORK_ERROR from Play Services) → "Google sign-in unavailable. Check your internet connection or update Google Play Services."
   - Apple cancellation / not available → friendly variants
   - Fallback → `error?.message` or "Something went wrong. Please try again."

2. Add a persistent inline error banner (red `bg-destructive/10` rounded box) above the email/password form, driven by a new `authError` state. It clears when the user edits any field or switches tabs. This makes the failure visible even after the toast disappears (important on Android where toasts can be missed).

3. Update each handler — `handleSignIn`, `handleSignUp`, `handleGoogleSignIn`, `handleAppleSignIn`, `handlePasswordReset` — to:
   - wrap in `try / catch`,
   - run the error through `getAuthErrorMessage`,
   - call `toast.error(msg)` AND `setAuthError(msg)`,
   - log the raw error to console for debugging.

4. Keep the existing generic "invalid credentials" message for password sign-in (to prevent email enumeration) but show it via the banner too.

## Files touched
- `src/pages/Auth.tsx` — add helper, add `authError` state + banner, update 5 handlers.

No backend/RLS/edge function changes. Pure presentation.

## Out of scope
- Fixing the underlying Android Google Play Services connectivity error (that's an emulator / device network issue, not code).
- Changing OAuth provider configuration.