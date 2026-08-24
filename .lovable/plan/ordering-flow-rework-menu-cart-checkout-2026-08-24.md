# Ordering Flow Rework: Menu → Cart → Checkout

Goal: make ordering faster and less error-prone. Fewer taps to add food, a cart that always shows what it will cost, and a checkout that fails loudly and clearly instead of silently.

## 1. Menu screen

**Search**
Add a search field in the sticky category bar (collapses to an icon, expands over the chips). Filters items live by name and description across all categories, with a "no matches" state that offers to clear the search. Today the only way to find a dish is scrolling a long list.

**One-tap add**
Menu rows get a round add button on the right. Items with no required options add straight to the cart with a small quantity stepper appearing in place; items with required options still open the detail sheet. The card itself keeps opening the detail sheet.

**In-cart awareness**
Rows for items already in the cart show their current quantity, so it is obvious what has been picked up while browsing.

**Sticky cart bar**
A persistent bar above the bottom navigation showing item count and running total, tapping through to the cart. Right now the cart total is invisible while browsing.

**Consistency**
The active category chip currently uses a hardcoded yellow; switch it to the brand/primary token so it themes correctly in all four themes.

## 2. Cart screen

**Sticky summary and checkout**
Move the total + checkout button into a fixed bottom bar (safe-area aware) so it is always reachable. Expand it from a bare total into subtotal, delivery fee, service fee and tax preview so the checkout total is not a surprise.

**Better structure**
- Show item count in the header ("3 items").
- Filter out recommendations that are already in the cart.
- Undo toast after a swipe-delete instead of permanent removal.
- Empty-cart state gets a clear "Browse the menu" action.

**Fix editing duplicates**
Editing a cart line currently matches by item id, so if the same dish is in the cart twice with different options, editing one can overwrite the wrong line. Match on the cart line key instead, and preserve quantity/notes when re-adding.

**Availability check**
On entering the cart, verify each line is still available at the selected branch and flag anything unavailable before checkout instead of failing at payment.

## 3. Checkout screen

**Clear progression**
Group the page into three labelled steps — delivery/pickup details, payment method, review — so the long form reads as ordered stages rather than one wall.

**Validation that guides**
Missing fields highlight, scroll to the first problem, and the pay button explains what is blocking it ("Add a delivery address") instead of just being disabled.

**Honest failures**
Surface the actual reason a payment or order failed (declined card, branch paused, address out of range) with a retry that keeps all entered data, rather than a generic error.

**Order summary**
Collapsible item list with the full fee breakdown, matching the cart bar exactly, plus the dynamic delivery estimate already used elsewhere.

## Technical notes

- Files touched: `src/components/MenuDisplay.tsx`, `src/components/menu/MenuItem.tsx`, `src/pages/Cart.tsx`, `src/components/cart/SwipeableCartItem.tsx`, `src/pages/Checkout.tsx`, `src/components/checkout/CheckoutForm.tsx`, plus new small components (menu search, sticky cart bar, fee summary).
- The fee summary becomes a single shared component driven by the existing delivery-fee, service-fee and tax logic, used in both cart and checkout so the numbers cannot drift apart.
- No database or edge-function changes; existing cart context, delivery-fee formula and payment paths (card, wallet, cash) stay intact.
- All new styling uses existing semantic tokens; safe-area utilities used for the fixed bars.
