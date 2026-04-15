

## Fix: Staff Panel Refund Not Working + Apple Pay Button Lock After Cancel

### Issue 1: Staff Panel Refund Never Reaches Backend

**Root cause:** The `refund-order` edge function has zero logs — confirmed via log inspection. The function IS deployed (responds to direct HTTP calls with 401 for unauthenticated requests), but from the staff panel, the `.then()` error callback may be silently failing. The most likely cause is that the function needs redeployment with the latest code, OR the `supabase.functions.invoke` call returns a `FunctionsHttpError` that the `.then()` handler catches but the toast disappears before the staff notices.

**Fix:** 
1. Redeploy `refund-order` to ensure latest code is live
2. Change the staff panel's refund call from fire-and-forget `.then()` to **awaited** within the mutation, with explicit error logging and persistent toast
3. Add `console.log` at the very first line of the function handler (before auth check) to confirm requests arrive

**File: `supabase/functions/refund-order/index.ts`** — Add a top-level log before auth:
```typescript
console.log('refund-order invoked, method:', req.method);
```

**File: `src/pages/staff/StaffOrders.tsx`** — Make refund call awaited and add better error reporting:
```typescript
// Inside mutationFn, after the DB update succeeds:
if (status === 'cancelled') {
  try {
    const { data, error: refundErr } = await supabase.functions.invoke('refund-order', { body: { order_id: id } });
    if (refundErr) {
      console.error('Refund invocation error:', refundErr);
      toast.error('Refund failed', { description: refundErr.message || 'Could not process automatic refund.', duration: 10000 });
    } else if (data?.refunded) {
      toast.success('Refund issued', { description: 'Payment has been refunded.', duration: 5000 });
    } else if (data?.reason) {
      console.log('Refund skipped:', data.reason);
    }
  } catch (e) {
    console.error('Refund call exception:', e);
    toast.error('Refund error', { description: 'Unexpected error processing refund.', duration: 10000 });
  }
}
```

Same change in **`src/pages/admin/OrderManagement.tsx`**.

### Issue 2: Apple Pay Button Locks After Cancel

**Root cause:** In `Checkout.tsx`, clicking the Place Order button sets `isPlacingOrderRef.current = true` (line 1222). The button is disabled when `isPlacingOrderRef.current` is true (line 1347). After wallet cancellation, `loading` is set to false, which triggers a re-render. However, the `useEffect` that resets `isPlacingOrderRef` (line 124-126) runs AFTER that render — so during the render, the button's `disabled` prop still reads the ref as `true`. Since the ref reset doesn't trigger another re-render, the button stays disabled permanently.

**Fix in `src/pages/Checkout.tsx`:** Instead of relying on a useEffect to reset the ref after loading changes, reset `isPlacingOrderRef.current = false` synchronously alongside `setLoading(false)` in the form's cancel paths. Additionally, change the button's disabled check to not use the ref directly — use a state variable instead, OR reset the ref before calling `setLoading(false)`.

Simplest fix — change the guard from a ref to a state variable, or remove `isPlacingOrderRef.current` from the `disabled` check since `loading` already serves the same purpose:

```typescript
// Line 1347 — remove isPlacingOrderRef.current from disabled:
disabled={loading || (currentPaymentType === 'wallet' && !stripeReady)}
```

Keep the duplicate-click guard in the onClick handler (line 1221) but don't let it control the disabled state, since `loading` already handles that.

### Files to Modify
1. `supabase/functions/refund-order/index.ts` — Add top-level request logging
2. `src/pages/staff/StaffOrders.tsx` — Await refund call, persistent error toasts
3. `src/pages/admin/OrderManagement.tsx` — Same refund handling improvement  
4. `src/pages/Checkout.tsx` — Remove `isPlacingOrderRef.current` from button disabled check

No database migration needed.

