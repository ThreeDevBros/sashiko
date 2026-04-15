

## Fix Apple Pay Cancellation Error + Staff Panel Refund

### Issue 1: Apple Pay Cancellation Still Shows Error

**Root cause:** In `src/lib/nativeStripePay.ts` line 204-211, when the user cancels Apple Pay, the Capacitor plugin may return a `paymentResult` value that is neither `'Canceled'` nor in the `completedResults` array (e.g., `undefined`, `null`, or an unexpected string). This hits line 210 and returns an error message instead of treating it as a cancellation.

**Fix in `src/lib/nativeStripePay.ts`:** Invert the logic — only proceed if the result is explicitly a known success. Treat everything else as cancellation:

```typescript
const paymentResult = walletResult?.paymentResult;
const completedResults = ['Completed', 'applePayCompleted', 'googlePayCompleted'];
if (!paymentResult || !completedResults.includes(paymentResult)) {
  // Not a recognized success — treat as user cancellation
  return { success: false, cancelled: true };
}
```

This removes the error path entirely for wallet dismissals. The only two outcomes from `presentApplePay()` are success or cancel — there is no partial failure state.

### Issue 2: Staff Panel Refund Not Working for Apple Pay Orders

**Root cause:** The `refund-order` edge function has **zero logs**, meaning it may not be receiving requests at all, or it's failing before logging. Investigating the code:

- `confirm-payment/index.ts` line 137 hardcodes `payment_method: 'card'` for ALL Stripe-based orders including Apple Pay — this is fine for refund logic (it only skips `'cash'`).
- The `stripe_payment_intent_id` IS stored correctly.
- The staff panel calls `refund-order` fire-and-forget, so errors are swallowed silently.

The most likely cause is that the function invocation itself fails silently. To fix this and ensure visibility:

1. **`src/pages/staff/StaffOrders.tsx`** — Make the refund call await-able and show a toast on failure instead of silently logging:
```typescript
if (status === 'cancelled') {
  supabase.functions.invoke('refund-order', { body: { order_id: id } })
    .then(async ({ data, error: refundErr }) => {
      if (refundErr) {
        console.error('Refund error:', refundErr);
        toast({ title: 'Refund failed', description: 'Could not process automatic refund.', variant: 'destructive' });
      } else {
        const result = data;
        if (result?.refunded) {
          toast({ title: 'Refund issued', description: 'Payment has been refunded.' });
        } else if (result?.reason === 'cash_order') {
          console.log('Cash order — no refund needed');
        }
      }
    });
}
```

2. **Same change in `src/pages/admin/OrderManagement.tsx`** — Add toast feedback for refund results.

3. **`supabase/functions/refund-order/index.ts`** — Add a log at function entry to confirm requests arrive:
```typescript
console.log('Refund request received for order:', order_id, 'by user:', user.id);
```

### Files to Modify
1. `src/lib/nativeStripePay.ts` — Fix cancellation detection logic
2. `src/pages/staff/StaffOrders.tsx` — Add refund result toasts
3. `src/pages/admin/OrderManagement.tsx` — Add refund result toasts
4. `supabase/functions/refund-order/index.ts` — Add entry logging

No database migration needed.

