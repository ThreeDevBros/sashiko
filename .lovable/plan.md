# Checkout out-of-range UX simplification

## Goal
Tighten the delivery out-of-range UI on `/checkout` so the map is the primary warning, the page is not cluttered with duplicate CTAs, and the call-to-action clearly explains why it is blocked.

## Changes

### 1. Simplify the out-of-range notice
- Update `src/components/checkout/OutOfRangeNotice.tsx`:
  - Remove the distance/radius explanation line.
  - Remove the "Change address" and "Switch to pickup" buttons.
  - Increase the title "Address outside delivery area" to a larger size (base font size).
  - Keep the amber container styling and the icon.

### 2. Remove duplicate warnings
- In `src/pages/Checkout.tsx`, inside the delivery address section:
  - Remove the "Out of range" pill above the address card.
  - Keep the amber ring around the address card (existing visual cue is enough).
  - Remove the `CheckoutSection` title prop so the "Delivery Address" header disappears.

### 3. Improve the address card icon
- In `renderDeliveryAddressCard()` in `src/pages/Checkout.tsx`:
  - Increase the address icon size from `h-5 w-5` to `h-6 w-6` or use a larger container that spans the full card height.
  - Change the icon color from `text-accent` to a color that is visible in both light and dark modes (e.g. `text-primary` or `text-foreground`).

### 4. Replace the pay button block state
- In `src/pages/Checkout.tsx`, remove the block-reason paragraph that currently says "This address is outside the delivery area..." above the Place Order button.
- Change the Place Order button behavior when delivery is out of range:
  - Text becomes "Sorry, delivery isn't possible there" (or similar) and remains readable.
  - The button is truly disabled (no onClick handler, no toast popup).
  - The existing disabled opacity styling is kept.
- Keep existing blocking logic for: branch paused, branch closed, missing delivery address, wallet not ready, guest card invalid.

## Files
- `src/components/checkout/OutOfRangeNotice.tsx`
- `src/pages/Checkout.tsx`
- `src/i18n/locales/en.json` and `src/i18n/locales/el.json` (add new button label key if needed)

## Notes
- No pricing, tax, or backend changes.
- Delivery stays selectable as already implemented; only the warning UI and the pay button copy are adjusted.
