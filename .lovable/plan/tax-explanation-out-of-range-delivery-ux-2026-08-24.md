# Tax explanation + out-of-range delivery UX

## 1. How tax is calculated on checkout (answer, no change needed)

Tax is computed per cart item, not as a single flat rate on the order:

- The default rate comes from branding/tenant settings (`vat_rate`), falling back to 10% if unset.
- Each menu item can override that with its own `tax_rate`.
- Each item also has a `tax_included_in_price` flag:
  - **Included**: the tax is extracted out of the shown price — `tax = line - line / (1 + rate/100)`, and subtotal shows the net amount.
  - **Excluded**: the tax is added on top — `tax = line * rate/100`, and subtotal shows the full price.
- Item taxes are summed into the single "Tax" row shown in the summary.
- Delivery fee and service fee are **not** taxed; the grand total is `subtotal + service fee + delivery fee + tax` (cashback deducted after).

## 2. Delivery must stay selectable when the address is out of range

Current behaviour: when the saved address is outside the branch radius, the Delivery toggle is disabled and the page force-switches to Pickup, so the user cannot get back to delivery to fix the address.

New behaviour:

- Delivery is always tappable. Remove the auto-switch to pickup and the disabled state.
- Selecting Delivery with an out-of-range address shows a clear, actionable state instead of a dead toggle:
  - The order-type row gets a warning treatment (amber ring/text on the Delivery half) when the current address is out of range.
  - A prominent inline notice under the toggle: title "Address outside delivery area", one line with the distance vs. the branch radius (e.g. "12.4 km away — we deliver up to 10 km"), and two actions: **Change address** (opens the existing address dialog) and **Switch to pickup**.
  - The delivery address card itself gets an amber border and a small "Out of range" tag so the offending item is visually identified.
- Paying stays blocked while out of range (existing `canDeliver` logic), and the pay button already explains the reason; its message stays.
- Pickup mode shows no delivery warnings at all — the "Delivery unavailable — address is outside our delivery area" line is removed, and the out-of-range notice only renders when Delivery is selected.

## Technical notes

- `src/pages/Checkout.tsx`: drop the `deliveryAvailable` auto-switch `useEffect` and the `disabled`/`opacity-40` props on the Delivery button; keep `canDeliver` for payment gating.
- Replace the small out-of-range paragraph with a new `src/components/checkout/OutOfRangeNotice.tsx` (semantic tokens only, no hardcoded colors — amber via existing warning styling used by the current alerts), rendered only when `orderType === 'delivery' && hasDeliveryLocation && !isWithinRadius`.
- Pass `isOutOfRange` into `renderDeliveryAddressCard()` to apply the warning border and tag.
- Distance and radius already exist (`deliveryDistance`, `deliveryRadiusKm`) — reused for the copy.
- No pricing, tax, or backend logic changes.
