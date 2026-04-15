

## Fix: Apple Pay Result String Mismatch

### Root Cause
Line 206 in `nativeStripePay.ts` checks `paymentResult !== 'Completed'`, but the Capacitor Stripe plugin returns `"applePayCompleted"` for successful Apple Pay (and likely `"googlePayCompleted"` for Google Pay). This mismatch causes the code to return an error message even though the payment succeeded and was charged.

### Fix
**File: `src/lib/nativeStripePay.ts`** — Update the completion check (lines 201-208) to accept all valid completion strings:

```typescript
const paymentResult = walletResult?.paymentResult;
if (paymentResult === 'Canceled') {
  return { success: false, cancelled: true };
}
const completedResults = ['Completed', 'applePayCompleted', 'googlePayCompleted'];
if (paymentResult && !completedResults.includes(paymentResult)) {
  return { success: false, error: 'Payment was not completed. Please try again.' };
}
```

Single file change, no migration needed.

