

## Fix Apple Pay "Order Not Complete" Error

### Root Cause Analysis

I traced the full Apple Pay payment flow and found **three bugs** in the `confirm-payment` edge function that cause order creation to fail after a successful Apple Pay charge:

1. **UUID type mismatch (primary crash)**: The function inserts `id: payment_intent_id` into the `orders` table (line 167), but payment intent IDs are strings like `pi_3TMXovIsawC8FwOE1qUeApzT` — not valid UUIDs. The `orders.id` column is UUID type, so the insert throws a PostgreSQL error every time.

2. **Broken duplicate check**: The "order already exists" check at line 130-133 queries `.eq('id', payment_intent_id)` — same UUID mismatch, so it always silently fails and never detects duplicates.

3. **Items metadata truncation**: When cart items exceed 450 chars, `create-payment-intent` stores `{ count: N, total: X }` instead of an array. The `confirm-payment` function blindly does `items.map(...)` on this object, causing a crash.

The server analytics confirm zero successful calls to `confirm-payment` during your payment attempts — the function crashes before completing.

### Plan

**File: `supabase/functions/confirm-payment/index.ts`**

1. Remove `id: payment_intent_id` from the order insert — let the database auto-generate a UUID via `gen_random_uuid()`
2. Fix the duplicate check to use the Stripe payment intent ID stored in a metadata field or by checking `order_number` patterns, rather than matching against the UUID `id` column. Add a `stripe_payment_intent_id` field to the insert and use it for dedup.
3. Handle truncated items metadata gracefully — when `items` is not an array (truncated case), re-fetch the item details from the payment intent's original metadata or skip order items creation with a fallback
4. Add a small retry/polling loop (up to 3 attempts, 1s apart) when `paymentIntent.status` is not yet `succeeded` to handle Apple Pay timing races

**Database migration**: Add a `stripe_payment_intent_id` text column to the `orders` table for reliable deduplication (with a unique index).

**File: `src/lib/nativeStripePay.ts`**
- No changes needed — the client-side code is correct. The issue is entirely server-side.

### Technical Details

The flow: Apple Pay succeeds → client calls `confirm-payment` with `pi_xxx` → function tries `INSERT INTO orders (id, ...) VALUES ('pi_xxx', ...)` → PostgreSQL rejects non-UUID → function returns 500 → client shows "Order could not be finalized."

After the fix, the flow will: let DB auto-generate the UUID, store `pi_xxx` in a dedicated `stripe_payment_intent_id` column, and use that for deduplication.

