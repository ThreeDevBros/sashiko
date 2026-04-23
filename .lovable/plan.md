

## Prefetch Stripe SDK at App Start (Eliminate /checkout Delay)

### Current state
- **Saved cards**: ✅ Already prefetched at app start in `src/App.tsx` (lines 230-234) and shared via React Query — no work needed here.
- **Stripe SDK**: ❌ Loaded inside `Checkout.tsx` (`useEffect` at lines 237-266) using local `useState`. Every time the user enters /checkout, `loadStripe()` and `get-public-keys` re-run from scratch — and on native, the Capacitor Stripe plugin re-initializes too. This is the actual delay the user feels.

### Goal
Initialize the Stripe SDK (web `loadStripe` + native plugin) **once** at app boot, cache it as a module-level singleton, and have `/checkout` consume the cached promise instantly — so:
- First entry to /checkout: no wait (SDK already loading/loaded in the background since boot).
- Subsequent entries (after going back to edit cart): instant — singleton is already resolved.

### Changes

**1. New file: `src/lib/stripeBootstrap.ts`** — module-level singleton
```ts
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { supabase } from '@/integrations/supabase/client';

let stripePromise: Promise<Stripe | null> | null = null;
let nativeReady = false;

export function getStripePromise(): Promise<Stripe | null> | null {
  return stripePromise;
}

export function isNativeStripeReady() {
  return nativeReady;
}

export async function initStripeOnce(): Promise<void> {
  if (stripePromise) return;
  try {
    const { data, error } = await supabase.functions.invoke('get-public-keys', {
      body: { key_type: 'STRIPE_PUBLISHABLE_KEY' },
    });
    if (error || !data?.key) return;
    stripePromise = loadStripe(data.key);

    const { isNativeWalletPlatform, initializeNativeStripe } = await import('@/lib/nativeStripePay');
    if (isNativeWalletPlatform()) {
      nativeReady = await initializeNativeStripe();
    }
  } catch (e) {
    console.error('[StripeBootstrap] init failed', e);
    stripePromise = null; // allow retry later
  }
}
```

**2. `src/App.tsx`** — kick off Stripe init at boot, alongside existing saved-cards prefetch
- Import `initStripeOnce` from `@/lib/stripeBootstrap`.
- In `AppContent`, add a `useEffect` that runs **once on mount** (no auth gate — Stripe publishable key is public and useful for guests too):
  ```ts
  useEffect(() => { void initStripeOnce(); }, []);
  ```

**3. `src/pages/Checkout.tsx`** — consume the cached singleton instead of local state
- Replace the local `stripePromise` / `stripeReady` state and the `useEffect` at lines 237-266 with:
  ```ts
  const [stripePromise, setStripePromise] = useState(() => getStripePromise());
  const [stripeReady, setStripeReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Ensure init has been triggered (idempotent — usually already done at boot)
      await initStripeOnce();
      if (cancelled) return;
      const p = getStripePromise();
      if (p) {
        setStripePromise(p);
        const s = await p;
        if (!cancelled && s) setStripeReady(true);
        if (!cancelled && isNativeStripeReady()) setStripeReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  ```
- Remove `loadStripe` import (now lives in the bootstrap module).

### Result
| Scenario | Before | After |
|---|---|---|
| First /checkout visit | ~1-2s wait for `get-public-keys` + `loadStripe` + native init | Already loading since boot — usually ready instantly |
| Back to cart → /checkout again | Re-fetches key, re-runs `loadStripe`, re-inits native plugin | Singleton resolved → instant |
| Saved cards | Already prefetched ✅ | No change — already optimal |

### Files
- **New**: `src/lib/stripeBootstrap.ts`
- **Edited**: `src/App.tsx` (one-line `useEffect` + import)
- **Edited**: `src/pages/Checkout.tsx` (replace local Stripe-loading effect with singleton consumer)

### Notes
- No backend, RLS, or DB changes.
- `GuestCardPayment.tsx` also calls `loadStripe` separately — out of scope for this change since it's only used inside the already-loaded checkout flow; can be migrated later if further speedup is wanted.
- Singleton is module-level, so it survives route changes and lazy-load remounts of the Checkout component.
- Failure path (network down at boot) still allows retry on /checkout entry because we reset `stripePromise = null` on error.

