# Checkout drawer + guest validation fixes

## 1. Payment method drawer jumps to top (native iOS)
The payment drawer is the only drawer on the page opened with `noBodyStyles` + `preventScrollRestoration`. Without vaul's scroll-lock the page scrolls to the top while the drawer is open and is restored on close — the jump the user sees. The delivery address drawer, which behaves correctly, uses plain defaults.

Fix: open the payment drawer with the same configuration as the address drawer (`shouldScaleBackground={false}` only, no `noBodyStyles`, no `preventScrollRestoration`) so the background keeps its scroll position.

## 2. Sticky top bar disappears while a drawer is open
The branch-name/back-button bar is `sticky top-0`. When a drawer locks the page scroll, the sticky bar loses its offset and slides out of view.

Fix: keep the bar visible by making it a fixed top bar (with the existing safe-area padding and a matching spacer so nothing shifts), sitting below the drawer overlay z-index so it gets dimmed and blurred together with the rest of the page instead of vanishing.

## 3. Guest fields: red outline + red label, no error sentences
- On validation failure the field border turns red (already) and the floating label ("Full Name", "Email", "Phone") also turns red.
- Remove the "Please enter your …" helper sentences under the fields — the red state alone communicates the problem.
- Errors clear as usual when the user edits the field.

## 4. Scroll further up on failed place-order
When Place Order is pressed with missing guest info, scroll so the Guest Information section sits comfortably below the top bar (extra offset instead of flush at the top edge), then focus the first invalid field.

## Technical notes
- `src/components/checkout/CheckoutForm.tsx` (~line 831): drop `preventScrollRestoration` and `noBodyStyles` from the payment `Drawer`.
- `src/pages/Checkout.tsx` (~line 634): header becomes `fixed inset-x-0 top-0 z-40` with a spacer div; verify against the `FloatingBranchWidget` and drawer overlay (`z-50`) layering.
- `src/components/checkout/FloatingLabelField.tsx`: add error-driven `text-destructive` on the label; stop rendering the error paragraph (keep the `error` prop as the red-state trigger).
- `src/lib/guestValidation.ts`: keep the same required checks; error values become presence flags only (no user-facing copy rendered).
- `src/pages/Checkout.tsx` (~line 1417): use a scroll offset (scroll-margin/manual `window.scrollTo`) instead of `block: 'start'`.
