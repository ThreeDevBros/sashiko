

## Add Payment Method Details to Staff & Admin Order Panels

### Approach
Rather than adding a new database column, we can **infer the payment method from existing data** — orders with a `stripe_payment_intent_id` were paid by card (Stripe/Apple Pay/Google Pay), and orders without one are cash orders. This avoids a migration and backfill.

However, for better granularity (distinguishing card vs Apple Pay vs Google Pay), we should add a `payment_method` column and populate it at order creation time.

### Plan

**1. Database migration** — Add `payment_method` text column to `orders` table (nullable, no default). Backfill existing rows: set to `'cash'` where `stripe_payment_intent_id IS NULL`, `'card'` otherwise.

**2. Update edge functions to store payment method**
- `confirm-payment/index.ts` — Set `payment_method: 'card'` on insert (covers card, Apple Pay, Google Pay via Stripe)
- `create-cash-order/index.ts` — Set `payment_method: 'cash'` on insert
- `stripe-webhook/index.ts` — If it creates orders, also set payment_method

**3. Display payment method in Admin OrderManagement**
- `src/pages/admin/OrderManagement.tsx` — Add "Payment" column to the desktop table showing a badge (e.g., 💳 Card / 💵 Cash)
- `src/components/admin/MobileOrderCards.tsx` — Add payment method pill in the summary row alongside Type/Items/Total

**4. Display payment method in Staff panels**
- `src/pages/staff/StaffOrders.tsx` — Add payment badge in order cards
- `src/components/staff/NewOrderPopup.tsx` — Show payment method in the order detail dialog

### Fallback Logic
If `payment_method` column is null (older orders), derive from `stripe_payment_intent_id`: present → "Card", absent → "Cash".

### Files to modify
- New migration SQL
- `supabase/functions/confirm-payment/index.ts`
- `supabase/functions/create-cash-order/index.ts`
- `src/pages/admin/OrderManagement.tsx`
- `src/components/admin/MobileOrderCards.tsx`
- `src/pages/staff/StaffOrders.tsx`
- `src/components/staff/NewOrderPopup.tsx`

