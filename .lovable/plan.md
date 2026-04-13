

## Safe Area Padding for Native iOS — All Screens

### Problem
The body CSS applies `padding-top: env(safe-area-inset-top)` globally, but this only affects the document flow — it does NOT help sticky/fixed headers, which overlay the safe area on notched iPhones. The home page (Index) works because its hero image is full-bleed and content starts below the notch naturally. Other screens (Order, Cart, Profile, Settings, OrderHistory, Checkout, etc.) have headers that sit under the notch/Dynamic Island.

Additionally, the MenuDisplay category bar uses `sticky top-0` without accounting for the safe area, so on native iOS it pins behind the notch.

### Approach
1. **Remove body-level safe-area padding-top** from `index.css` (it creates double padding on pages that handle it themselves)
2. **Add a reusable CSS utility class** `pt-safe` that applies `padding-top: env(safe-area-inset-top)` — use this on every page's top-level wrapper or sticky header
3. **Update all customer-facing page headers** to include safe-area-aware top padding on their sticky/fixed header or top-level container

### Files to modify

**`src/index.css`** — Remove `padding-top: env(safe-area-inset-top)` from body, add utility class `pt-safe`

**`src/pages/Order.tsx`** — Add `pt-safe` to the header element (line 35: `<header className="bg-background pt-4 pb-3 px-4">` → add safe area padding)

**`src/components/MenuDisplay.tsx`** — Update the sticky category bar from `sticky top-0` to account for safe area inset using inline style `top: env(safe-area-inset-top)` on mobile, and update `scroll-mt` on sections accordingly. Also update the skeleton's fixed bar.

**`src/pages/Cart.tsx`** — Add `pt-safe` to the sticky header (line 158)

**`src/pages/Profile.tsx`** — Add `pt-safe` to the main container top padding

**`src/pages/Settings.tsx`** — Add `pt-safe` to the main container

**`src/pages/OrderHistory.tsx`** — Add `pt-safe` to the container

**`src/pages/ReservationHistory.tsx`** — Add `pt-safe` to the container

**`src/pages/Checkout.tsx`** — Add `pt-safe` to the sticky header

**`src/pages/OrderTracking.tsx`** — Add `pt-safe` to sticky headers

**`src/pages/Address.tsx`** — Add `pt-safe` to all sticky headers across view modes

**`src/pages/Auth.tsx`** — Add `pt-safe` to the top-level wrapper

**`src/pages/TableBooking.tsx`** — Add `pt-safe` to the page header

**`src/pages/LegalPage.tsx`** — Add `pt-safe` to the container

**`src/pages/AccountDeletion.tsx`** — Add `pt-safe`

**`src/pages/CheckoutSuccess.tsx`** — Add `pt-safe`

**`src/pages/BranchMenu.tsx`** — Add `pt-safe` to the sticky header

**`src/components/BottomNav.tsx`** — Already handles bottom safe area, no change needed

**`src/components/TopNav.tsx`** — Already has inline style for `paddingTop: env(safe-area-inset-top)`, no change needed

### Technical detail

The utility class in `index.css`:
```css
.pt-safe {
  padding-top: env(safe-area-inset-top);
}
```

For sticky elements that use `top-0`, we'll add an inline style or CSS variable approach:
```css
.top-safe {
  top: env(safe-area-inset-top);
}
```

The MenuDisplay category bar will change from `sticky top-0` to `sticky top-safe` and section scroll-margin will use a CSS calc with the safe area variable.

### Expected result
- All screens on native iOS respect the notch/Dynamic Island
- Sticky headers pin below the safe area, not behind it
- Category bar on the menu page pins correctly below the order page header + safe area
- Bottom nav already handled, no regression

