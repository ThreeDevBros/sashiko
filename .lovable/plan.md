
## Show Branch Name on Apple Pay / Google Pay Sheet

### Problem
The Apple Pay (and Google Pay) native sheet shows "Pay Order Total" above the amount because we pass the static label `'Order Total'`. It should show the branch name instead, e.g. "Pay Sashiko Asian Fusion".

### Changes

**1. `src/components/checkout/CheckoutForm.tsx`**
- Import branding: `import { useBranding } from '@/hooks/useBranding';` and grab `const { branding } = useBranding();`
- Compute a single label: `const merchantLabel = branch?.name || branding?.tenant_name || 'Order Total';`
- **Native path** (line ~485): pass `merchantDisplayName: merchantLabel` into the `nativeWalletPay({...})` options object (it's already supported in `NativePayOptions` and used as the `paymentSummaryItems[0].label` for both Apple Pay and Google Pay).
- **Web path** (line ~550): change `label: 'Order Total'` to `label: merchantLabel` in the `stripe.paymentRequest({ total: {...} })` call so the browser Payment Request sheet also shows the branch name.

### Result
The native wallet sheet header changes from "Pay Order Total — €3,15" to "Pay Sashiko Asian Fusion — €3,15" (or the active branch name).

### Notes
- No changes needed in `src/lib/nativeStripePay.ts` — it already uses `options.merchantDisplayName` when provided and falls back to `'Order Total'`.
- Falls back gracefully to tenant name, then to `'Order Total'` if neither is loaded.
