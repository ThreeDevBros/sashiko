# Native iOS spacing fixes + guided sticky Place Order button

## 1. Cart bottom bar only (`/cart`)
- Revert the page-level bottom padding from `pb-52` back to a modest clearance (roughly the real footer height) so the page no longer scrolls with a large empty gap.
- Keep the fixed footer, but lift it slightly: keep `pb-safe` and add a small extra bottom padding so the total/checkout row sits clearly above the home indicator on notched iPhones.
- No changes to the page header or content spacing.

## 2. Checkout bottom padding (`/checkout`)
- Remove the large `pb-32` page padding; with the CTA becoming sticky (section 4) the page only needs enough bottom clearance to clear the sticky bar, not extra scroll room.
- Result: scrolling stops right after the summary — no over-scroll past the end.

## 3. Sticky categories must respect the safe area (`/order`)
- The category/search bar in `MenuDisplay` currently sticks at `top-0`, so on iOS it slides under the Dynamic Island.
- Stick it at the safe-area inset instead (`top: env(safe-area-inset-top)` on mobile, keeping the existing `md:top-14` desktop offset), and paint an opaque background strip behind the inset area so menu items don't show through above the bar.
- Update the category scroll-offset math (`scroll-mt` / `stickyBarHeight`) so tapping a category still lands the section right below the bar.

## 4. Guided sticky Place Order CTA (all platforms)
Replace the in-flow CTA with a sticky bottom bar on `/checkout` that guides the user through the page in steps.

States, in order:
1. **Not yet at the bottom of the page** (guest or signed-in): label like "Continue". Tapping smooth-scrolls to the next missing section (guest info first if not valid, then payment section), or to the summary section if everything above is already valid.
2. **Bottom of the page reached (summary visible)**: the bar becomes the real CTA — existing `PlaceOrderButton` with its current cash / card / Apple Pay / Google Pay variants, blocked labels, loading state, and click logic unchanged.
- Progress is tracked with an IntersectionObserver on the existing sections, so scrolling manually advances the button just like tapping it does; the button never blocks a user who scrolls on their own.
- Existing validation behaviour is preserved: if the user reaches the final state with missing guest info, the current red-outline + scroll-to-first-error logic still runs.
- The sticky bar uses the same visual language as the cart footer (hairline top border, translucent blurred background, `pb-safe` plus a little extra lift).

## Technical notes
- Files touched: `src/pages/Cart.tsx`, `src/pages/Checkout.tsx`, `src/components/MenuDisplay.tsx`, `src/pages/Order.tsx` (background strip only), and a small new component for the sticky checkout CTA bar wrapping `PlaceOrderButton`.
- No business-logic, pricing, payment, or backend changes — presentation and scroll behaviour only.
- New CTA labels go through i18n (`en`/`el`).

## Validation
- Web/Playwright: verify checkout CTA step progression (guest and signed-in), that scrolling stops cleanly at the summary, cart footer clearance, and the sticky category bar offset.
- Native iOS build: confirm the categories stay below the Dynamic Island, the cart bar clears the home indicator, and the checkout CTA stays above the home indicator.
