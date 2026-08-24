# Onboarding & Auth: UX Polish Pass

A set of small, low-risk improvements to the sign-in, sign-up, email-code and profile-completion screens. No changes to auth logic, providers, or backend — only presentation, input behaviour and feedback.

## 1. Keyboard, autofill and typing

Currently none of the auth inputs declare autofill or keyboard hints, so password managers guess badly and mobile keyboards show the wrong layout.

- Add `autoComplete` to every field: `email`, `current-password`, `new-password`, `name`, `tel`.
- Add `inputMode="email"` / `inputMode="tel"` and `enterKeyHint="next"` / `"go"` so the phone keyboard shows the right keys and Return submits.
- Add `autoCapitalize="none"` and `spellCheck={false}` to email fields (stops iOS capitalising the first letter).
- Autofocus the first field of the active tab on desktop only, so mobile keyboards don't cover the card on open.

## 2. Password fields

- Add a show/hide eye toggle to all password inputs (sign in, sign up, confirm, reset screen).
- Replace the static requirements line on sign-up with a live checklist that ticks each rule as it's met (12+ chars, uppercase, lowercase, number) plus a thin strength bar.
- On the reset-password screen, show the same checklist and an inline "passwords do not match" hint instead of only failing on submit.

## 3. Clearer state and copy

- The card heading currently reads "Sign up free" even while the Sign In tab is active. Make it follow the selected tab ("Welcome back" / "Create your account") with a short supporting line.
- Errors are shown twice today (inline banner + toast). Keep the inline banner only for form errors so the message doesn't double up; keep toasts for success.
- Move "Continue as guest" below the tabs so it's available from both tabs, not just Sign In.
- Prefill the Forgot-password dialog with whatever email is already typed.

## 4. Social buttons feedback

Google and Apple buttons never enter a loading state, so they look unresponsive while the provider sheet opens.

- Add a per-provider pending state: spinner in the button, both social buttons and the submit button disabled while pending.
- Clear pending state on error or cancellation.

## 5. Email code (OTP) screen

- Autofocus the code field and add `autoComplete="one-time-code"` so iOS/Android offer the code from the SMS/mail notification.
- On an invalid code, shake the field and keep focus instead of silently clearing it.
- Add a visible "Wrong email? Change it" action next to the back arrow.
- Show the resend cooldown as "Resend in 45s" text on the button itself.

## 6. Accessibility and native feel

- Add real (screen-reader only) `<label>` elements for the placeholder-only sign-up fields.
- Add `aria-live` to the error banner and `aria-busy` to submitting buttons.
- Add light haptics (existing `useHaptics` hook) on submit, success, and error — native only, no-ops on web.
- Ensure visible focus rings on all auth buttons and inputs for keyboard/desktop users.

## Technical notes

Files touched: `src/pages/Auth.tsx`, `src/components/auth/OtpVerification.tsx`, `src/components/CompleteProfileDialog.tsx`, plus new strings in `src/i18n/locales/en.json` and `el.json`. A small `PasswordField` and `PasswordChecklist` component will be added under `src/components/auth/` to avoid repeating the toggle/checklist markup across four places. All colours use existing semantic tokens; no auth flow, session handling, or provider configuration changes.
