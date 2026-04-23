import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { supabase } from '@/integrations/supabase/client';

let stripePromise: Promise<Stripe | null> | null = null;
let nativeReady = false;

export function getStripePromise(): Promise<Stripe | null> | null {
  return stripePromise;
}

export function isNativeStripeReady(): boolean {
  return nativeReady;
}

export async function initStripeOnce(): Promise<void> {
  if (stripePromise) return;
  try {
    const { data, error } = await supabase.functions.invoke('get-public-keys', {
      body: { key_type: 'STRIPE_PUBLISHABLE_KEY' },
    });
    if (error || !data?.key) {
      console.warn('[StripeBootstrap] No Stripe key returned');
      return;
    }
    stripePromise = loadStripe(data.key);

    try {
      const { isNativeWalletPlatform, initializeNativeStripe } = await import('@/lib/nativeStripePay');
      if (isNativeWalletPlatform()) {
        nativeReady = await initializeNativeStripe();
        if (nativeReady) console.log('[StripeBootstrap] Native Stripe plugin ready');
      }
    } catch (e) {
      console.warn('[StripeBootstrap] Native Stripe init skipped:', e);
    }
  } catch (e) {
    console.error('[StripeBootstrap] init failed', e);
    stripePromise = null; // allow retry later
  }
}
