# iOS polish + menu/checkout interaction pass

## iOS fixes

1. **Sticky categories need an opaque strip above them (`/order`)**
   The category bar sticks at `env(safe-area-inset-top)`, so menu content scrolls through the notch/Dynamic Island area above it. Add a fixed opaque background strip covering the top inset (same `bg-background`, sitting just under the bar in stacking order) so nothing shows above the categories.

2. **Continue scrolls too far (`/checkout`)**
   `StickyCheckoutCTA` uses plain `scrollIntoView({ block: 'start' })`, which lands the section title under the Dynamic Island. Scroll with an explicit offset instead (element top minus safe-area inset minus the fixed checkout header height plus a small gap), so "Guest Information" sits just below the island. Same offset applied for the payment and summary steps.

## Menu (all platforms)

3. **Quick-add `+` size stability** — make the standalone `+` button in `MenuItem` render at the same footprint as the `- 1 +` stepper (same height and vertical alignment), so adding an item does not resize the row.

4. **Expand animation on quick add** — animate the `+` pill growing sideways into the `- 1 +` stepper (width/opacity transition on the stepper, fade of the lone `+`), instead of an instant swap.

5. **Search expands sideways** — tapping the search icon animates the button widening into the full search field while the category chips slide/scroll out of the way (translate + fade of the chip row), rather than the field appearing on top. Reverse on close.

6. **Constant bar height** — search field and its `X` close button use the same height as the category chips so the sticky bar never changes height when search opens or closes.

7. **Circular search button** — round the collapsed search button fully (`rounded-full`) so it no longer clips against neighbouring chips.

## Checkout CTA (all platforms)

8. **Same size** — `Continue` and `PlaceOrderButton` currently differ (`h-14` vs `h-16`). Unify to one height and radius so the sticky bar never jumps.

9. **Transition between labels** — cross-fade/slide when the CTA switches from "Continue" to Place Order / Pay.

10. **Transition between payment variants** — cross-fade when the selected payment method changes (Apple Pay ↔ Google Pay ↔ Pay now ↔ Place order), keyed on the variant.

11. **Remove Stripe references on card payment** — drop "Secured with Stripe encryption" (and the accompanying Stripe wording) from `AddCardForm` and `GuestCardPayment`; keep a neutral lock/secure-payment line instead.

## Technical notes

- Files: `src/components/MenuDisplay.tsx`, `src/components/menu/MenuItem.tsx`, `src/components/checkout/StickyCheckoutCTA.tsx`, `src/components/checkout/PlaceOrderButton.tsx`, `src/components/checkout/AddCardForm.tsx`, `src/components/checkout/GuestCardPayment.tsx`, plus a small opaque top strip in `src/pages/Order.tsx`.
- Presentation only: no pricing, payment, validation, or backend logic changes. Stripe stays the processor; only its visible branding is removed.
- Animations use existing Tailwind keyframes/transitions; no new dependency.

## Validation

- Playwright on web: CTA height parity, label/variant transitions, search expand/collapse keeps bar height, quick-add stepper animation.
- Native iOS build: categories fully opaque under the Dynamic Island; Continue lands "Guest Information" just below it.
