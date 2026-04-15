

## Fix: Refund Function Not Processing Refunds

### Investigation Results

**The `refund-order` edge function works correctly.** Direct testing with two real cancelled orders produced successful Stripe refunds (`re_3TMZhuIsawC8FwOE3qDJIDoL` and `re_3TMZg3IsawC8FwOE1uCRy3va`). The function is deployed and responds to requests.

**The problem: zero historical logs.** Before our direct test, the function had zero boot logs, zero HTTP logs, and zero application logs. This means `supabase.functions.invoke('refund-order', ...)` from the client app **never reached the backend**. Possible causes:
- The function was not deployed in earlier versions and only became available after recent edits
- On native iOS, network requests can be silently dropped if the app transitions to background during the mutation
- The fire-and-forget pattern in `OrderTracking.tsx` (line 531) doesn't await results, so navigation away kills the request

### Fix Strategy

Make refund invocation resilient and add better diagnostics to catch future failures.

### Changes

**1. `src/pages/OrderTracking.tsx` — Await the refund call instead of fire-and-forget**
- Line 531: Change from `.then()` fire-and-forget to `await` so the refund completes before the function exits
- Add error logging with toast on failure

**2. `src/pages/staff/StaffOrders.tsx` — Add verbose logging around the refund call**
- Add `console.log` before invoking refund-order so we can confirm the code path is reached
- Log the full response from `supabase.functions.invoke` for debugging

**3. `src/pages/admin/OrderManagement.tsx` — Same logging improvements**
- Mirror the staff panel logging changes

**4. `supabase/functions/refund-order/index.ts` — Modernize to `Deno.serve`**
- Replace `import { serve }` with `Deno.serve` to match other working functions and ensure deployment compatibility
- This is a safety measure — the old pattern works but the newer pattern is more reliable with the Lovable deployment pipeline

### No database migration needed.

