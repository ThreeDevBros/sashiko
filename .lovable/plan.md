

## Root Cause

The bug is a **React Rules of Hooks violation** in `CheckoutForm.tsx` (lines 89-94):

```typescript
try {
  stripe = useStripe();
  elements = useElements();
} catch (e) {
  // Hooks not available (guest mode without Elements wrapper)
}
```

React hooks **must** be called unconditionally at the top level — wrapping them in try/catch does not make them safe. When `CheckoutForm` renders without an `<Elements>` wrapper (which happens for guests on cash, and for logged-in users before `clientSecret` loads), these hooks throw internally, corrupting React's hook tracking. This causes unpredictable behavior: the drawer state, card selection, and UI updates all break silently because React's internal fiber state is out of sync.

The `Checkout.tsx` page conditionally wraps `CheckoutForm` in `<Elements>` based on payment type — so the same component mounts/unmounts with and without the provider, making this hook violation trigger frequently on native iOS.

## Plan

### 1. Split CheckoutForm to respect Rules of Hooks

**File:** `src/components/checkout/CheckoutForm.tsx`

- Remove the try/catch around `useStripe()` / `useElements()`
- Accept `stripe` and `elements` as **optional props** instead of calling the hooks directly
- Create a thin wrapper component `StripeCheckoutForm` that calls the hooks and passes them down

```
CheckoutForm          — receives stripe/elements as props (no hooks)
StripeCheckoutForm    — calls useStripe()/useElements(), forwards to CheckoutForm
```

### 2. Update Checkout.tsx to use the correct wrapper

**File:** `src/pages/Checkout.tsx`

- When inside `<Elements>`, render `<StripeCheckoutForm>` (which calls hooks safely)
- When outside `<Elements>`, render `<CheckoutForm>` directly (stripe/elements will be null)
- Remove the duplicated conditional wrapping logic — simplify to two clear paths

This eliminates the hooks violation entirely. No hook is ever called outside its provider.

### Technical Details

The core issue: React tracks hooks by **call order per component instance**. When `useStripe()` throws inside try/catch, React has already incremented its hook counter. The catch swallows the error but the counter is wrong, so every subsequent hook (`useState`, `useEffect`, etc.) reads from the wrong slot. This causes state to leak between hooks — explaining why the drawer opens/closes erratically, selections don't stick, and the UI feels "buggy" without a visible error.

