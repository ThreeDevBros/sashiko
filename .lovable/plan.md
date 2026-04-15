

## Investigation: Refund Function — Guest vs Signed-In, Card vs Apple/Google Pay

### Current State of `refund-order/index.ts`

The edge function logic is sound for **signed-in users** with card or wallet payments:
- Looks up order by UUID, retrieves `stripe_payment_intent_id`
- Checks auth: allows admin/staff/manager, order owner, or guest orders (`user_id` is null)
- Skips cash orders, checks PI status is `succeeded`, issues `stripe.refunds.create()`

### Findings by Scenario

| Scenario | Works? | Why |
|----------|--------|-----|
| **Signed-in + Card** | Yes | User has JWT, `isOwner` is true, PI exists |
| **Signed-in + Apple/Google Pay** | Yes | Same as card — Apple/Google Pay still creates a Stripe PI |
| **Guest + Card** | **NO** | Guest has no auth session → 401 Unauthorized |
| **Guest + Apple/Google Pay** | **NO** | Same — no auth session → 401 Unauthorized |

### Root Cause

The `refund-order` function **requires authentication** (lines 27-46). Guest users on the OrderTracking page have no Supabase JWT — they load order data via the `get-guest-order` edge function using email verification. When a guest cancels, `supabase.functions.invoke('refund-order', ...)` sends only the anon key, and the function returns 401.

Additionally, the guest cancel flow at line 501-504 does `supabase.from('orders').update(...)` which will also fail silently due to RLS (no authenticated user = no matching policy).

### Second Issue: Guest Order Status Update Also Fails

The `handleCancelOrder` function updates the order status via the Supabase client directly (line 501-504). For guest users with no auth session, RLS blocks this update. The cancel appears to work client-side (optimistic UI at line 514) but the database never actually updates.

### Fix Plan

**Option: Make refund-order accept guest verification (email + order_id) without JWT**

1. **`supabase/functions/refund-order/index.ts`** — Add a guest path:
   - If no valid JWT, check for `guest_email` in the request body
   - Verify the order's `guest_email` matches the provided email (same pattern as `get-guest-order`)
   - If verified, proceed with the refund
   - This covers both card and Apple/Google Pay guest refunds

2. **`src/pages/OrderTracking.tsx`** — Update `handleCancelOrder` for guests:
   - Instead of direct `supabase.from('orders').update(...)`, call a new or modified edge function that handles both the status update and refund for guest orders
   - OR: extend `refund-order` to also update the order status to `cancelled` when called by a guest
   - Pass `guest_email` in the refund request body

3. **Alternative simpler approach**: Create a `cancel-guest-order` edge function that:
   - Accepts `order_id` + `guest_email`
   - Verifies email matches `orders.guest_email`
   - Updates order status to `cancelled`
   - Triggers Stripe refund if applicable
   - Returns success

### Recommended Approach

Create a dedicated **`cancel-guest-order`** edge function (cleanest separation). Modify `OrderTracking.tsx` to use it for guest cancellations. This avoids weakening auth on the existing refund function.

### Files to Modify
1. **New: `supabase/functions/cancel-guest-order/index.ts`** — Verify guest email, update status, issue Stripe refund
2. **`src/pages/OrderTracking.tsx`** — Use `cancel-guest-order` for guest users instead of direct DB update + separate refund call

### Technical Details

```typescript
// cancel-guest-order/index.ts (simplified)
// 1. Validate { order_id, guest_email }
// 2. Lookup order with service role, verify guest_email matches
// 3. Check order is still 'pending'
// 4. Update status to 'cancelled'
// 5. If stripe_payment_intent_id exists, issue refund
// 6. Return success
```

```typescript
// OrderTracking.tsx — handleCancelOrder guest path
if (isGuest) {
  const email = guestOrders.find(o => o.id === order.id)?.email;
  const { data, error } = await supabase.functions.invoke('cancel-guest-order', {
    body: { order_id: order.id, guest_email: email }
  });
  if (error) throw error;
  // Update UI optimistically
}
```

For signed-in users (both card and wallet), the current flow works correctly — no changes needed.

