

## Fix: Handle "Already Refunded" Stripe Error Gracefully

### Summary

The `refund-order` edge function is deployed and working. All your cancelled orders have now been manually refunded. Going forward, refunds will process automatically when orders are cancelled.

There is one remaining bug: when Stripe reports a charge is already refunded, the function crashes with a 500 error instead of returning a clean response. This needs a small fix.

### Immediate Status
- **Orders refunded manually right now**: `27047cd3` and `d7309ee9` (the two most recent)
- **Orders already refunded from earlier session**: `865d5b7a`, `ec1c0d14`, `a6dc9a22`, `22cc1fa6`, `b67a31ad`, `ff9beb13`
- All your cancelled card orders have been refunded

### Root Cause
The function was likely not deployed in earlier versions. Recent file edits triggered a fresh deployment, which is why all previous app-side calls produced zero logs (requests got 404 at the gateway before reaching the function).

### Change

**`supabase/functions/refund-order/index.ts`**
- Wrap the `stripe.refunds.create()` call in a try/catch that specifically handles the `charge_already_refunded` error code
- Return `{ success: true, refunded: false, reason: 'already_refunded' }` instead of a 500 error
- This prevents false error toasts in the staff/admin UI when a refund is retried

```text
Before:
  stripe.refunds.create() → Stripe error → catch block → 500

After:
  stripe.refunds.create() → Stripe error →
    if code === 'charge_already_refunded' → 200 with reason
    else → 500
```

### No database migration needed.

