

## Plan: Delete Saved Cards & Suppress Payment Cancellation Errors

### 1. Create `delete-saved-card` Edge Function
**New file: `supabase/functions/delete-saved-card/index.ts`**
- Accepts `{ card_id: string }` from authenticated users
- Authenticates the user, finds their Stripe customer by email
- Calls `stripe.paymentMethods.detach(card_id)` to remove the card
- Returns success/error

### 2. Add Delete Card UI in CheckoutForm
**File: `src/components/checkout/CheckoutForm.tsx`**
- Add a small trash/X icon button on each saved card row (lines ~769-792)
- On click, call `supabase.functions.invoke('delete-saved-card', { body: { card_id } })`
- On success, call `refreshCards()` from `useSavedCards` hook and remove from local state
- If the deleted card was selected, reset to another card or default payment method

### 3. Suppress Cancellation Errors
**File: `src/components/checkout/CheckoutForm.tsx`** (lines ~711-723)
- In the main `catch` block, detect cancellation errors (same pattern as `nativeStripePay.ts`: check for "canceled", "cancelled", "cancel" in error message) and silently reset state instead of showing the error toast
- The `paymentRequest.show()` on web throws `AbortError` when dismissed — catch that too

The native path already handles cancellation correctly (lines 476-481 return early without error). The issue is the outer `catch` block catching web wallet cancellations and showing a destructive toast.

### Technical Details
- The `delete-saved-card` function verifies the card belongs to the requesting user's Stripe customer before detaching
- No database migration needed — cards are stored in Stripe, not in our DB
- Cancel detection keywords: `canceled`, `cancelled`, `cancel`, `abort`, `AbortError`

