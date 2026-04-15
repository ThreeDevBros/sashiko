

## Fix Order Refund Flow

### Bugs Found

1. **UUID vs Payment Intent mismatch (refund never fires)**: All three callers (`OrderTracking.tsx`, `StaffOrders.tsx`, `OrderManagement.tsx`) pass the order's UUID (e.g. `a1b2c3d4-...`) as `order_id`. The edge function then checks `order_id.startsWith('pi_')` — which is always false for a UUID — so it returns `{ reason: 'cash_order' }` and skips the Stripe refund entirely.

2. **Admin-only auth blocks customer refunds**: The function requires admin role (line 48-61), but customers trigger refunds from the order tracking page. Their requests are rejected with 403 Forbidden, and the error is silently logged in the console.

### Fix

**File: `supabase/functions/refund-order/index.ts`** — Rewrite the core logic:

1. Accept `order_id` as the order's UUID (as all callers send it)
2. Look up the order in the `orders` table to get `stripe_payment_intent_id`, `user_id`, and `payment_method`
3. If `payment_method` is `'cash'` or `stripe_payment_intent_id` is null, return early (no refund needed)
4. Broaden auth: allow the request if the caller is an admin, a staff member, OR the order's owner (`user_id` matches the authenticated user)
5. Use the retrieved `stripe_payment_intent_id` to call `stripe.refunds.create()`

### Technical Details

The callers (`OrderTracking.tsx`, `StaffOrders.tsx`, `OrderManagement.tsx`) are all correct — they pass `{ order_id: order.id }` which is the UUID. No client-side changes needed.

The fix is entirely in the edge function: query the orders table first, then use the `stripe_payment_intent_id` column (added in a recent migration) to issue the Stripe refund.

