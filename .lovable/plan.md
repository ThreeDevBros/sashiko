# Payment Processing Overlay on Checkout

Replace the silent "loading" state during checkout with a full-screen, blurred processing overlay that animates through three states: processing, success, failure.

## Behaviour

1. **Processing** — the moment the user submits payment (card, wallet, or cash order), the checkout page behind is blurred and dimmed, and a smooth spinning circle appears with the text "Processing payment...". The page is non-interactive while this shows.
2. **Success** — the circle morphs into a check mark with a spring/scale animation and the text "Payment successful". After a short beat (~1.2s) the user is redirected to the order tracking page as today.
3. **Failure** — the circle morphs into an X with the text "Payment failed", plus the specific reason underneath when we have one (Stripe decline message, edge-function error message). A "Try again" / dismiss button closes the overlay and leaves the user on the checkout page with their cart and form intact so they can retry.
4. **Cancellation** (wallet sheet dismissed, 3DS aborted) — overlay closes immediately with no error, as it does today.

## Visual direction

- Blurred backdrop over the whole viewport (backdrop-blur + semi-transparent scrim using existing design tokens, respects all four themes).
- Circle: a stroked ring with a rotating arc, continuous smooth rotation (Framer Motion, already used in the project via `AnimatedPage`).
- Success/failure: the ring collapses to a filled circle and the icon path draws in; colours from semantic tokens (primary/green for success, destructive for failure).
- Safe-area aware, centred, respects reduced-motion preference.

## Technical notes

- New component `src/components/checkout/PaymentProcessingOverlay.tsx` — presentational, driven by a `status` prop (`'idle' | 'processing' | 'success' | 'error'`), an optional `message`, and `onDismiss`.
- In `src/components/checkout/CheckoutForm.tsx`: add a `paymentStatus` state alongside the existing `loading` flag and set it in the existing branches of `handleSubmit`:
  - `processing` where `setLoading(true)` happens
  - `success` immediately before each `navigate('/order-tracking/...')` call (card, saved card, native wallet, web wallet, cash) — navigation moves behind a short delay so the tick is visible
  - `error` in the catch block and in the `setError(...)` early-return paths, carrying the same message already extracted there
  - `idle` on the cancellation paths and on dismiss
- The existing inline `Alert` error and toasts stay for context; the overlay becomes the primary feedback surface.
- Overlay renders at a z-index above checkout sheets/dialogs, consistent with the project's 10001+ convention.
- Strings added to `src/i18n/locales/en.json` and `el.json`.
- No changes to payment logic, edge functions, or order creation.
