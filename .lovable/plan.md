# Checkout form cleanup

Four focused changes on `/checkout`, all presentation-level.

## 1. Instructions for courier
- Rename "Order Instructions" to "Instructions for courier".
- Show the field only for delivery orders (hidden entirely on pickup).
- Remove the section heading and the "(Optional)" note — no title row at all.
- Give the textarea a real border matching the other inputs (bordered, rounded, same focus ring), instead of the current bottom-line-only style.
- The label lives as a floating overlay label on the field itself, so the purpose is clear without a heading. Stays optional; the 300-character counter stays.

## 2. Guest section subtext
Remove "We need your contact information to process your order".

## 3. Guest fields as floating labels
- Remove the standalone "Full Name", "Email", "Phone" labels; each becomes a floating overlay label inside the input (sits centered when empty, shrinks to the top edge when focused/filled).
- Drop the red `*`. Required-ness is communicated with a small muted "Required" hint beside the floating label, and the existing validation behaviour (inline error text + red border on submit) is unchanged.
- Fields remain required for proceeding — no validation logic changes.

## 4. Remove step scaffolding
- Delete the "Step 1", "Step 2", "Step 3" eyebrows from the Order Type, Payment Method and Summary sections.
- Remove the "Fill in your name, email and phone to continue." blocking message (other block reasons — branch closed, missing address, out of range, wallet loading — stay).

## Technical notes
- `src/components/checkout/GuestCheckoutForm.tsx`: replace `Label` + `Input` pairs with a small reusable floating-label field; keep `data-field` attributes so auto-scroll-to-error keeps working.
- New `src/components/checkout/FloatingLabelField.tsx` (input + textarea variants) using existing design tokens; no hardcoded colors.
- `src/pages/Checkout.tsx`: drop `step` props from the three `CheckoutSection` usages, wrap the instructions block in an `orderType === 'delivery'` condition, and remove the guest-info block reason. `orderInstructions` state stays as-is; it will simply be empty for pickup.
- Add an "Instructions for courier" translation key to `src/i18n/locales/en.json` and `el.json`, reusing the existing placeholder key.
