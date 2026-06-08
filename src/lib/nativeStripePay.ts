import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

interface PaymentItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string | null;
  special_instructions?: string;
}

interface NativePayOptions {
  items: PaymentItem[];
  branchId: string | null;
  orderType: 'delivery' | 'pickup' | 'dine_in';
  deliveryAddressId: string | null;
  guestInfo?: { name: string; email: string; phone: string } | null;
  guestAddress?: string | null;
  guestDeliveryLat?: number | null;
  guestDeliveryLng?: number | null;
  scheduledDateTime?: string | null;
  deliveryFee: number;
  serviceFee?: number;
  currency: string;
  tax: number;
  orderTotal: number;
  cashbackUsed?: number;
  merchantDisplayName?: string;
  countryCode?: string;
}

interface NativePayResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  error?: string;
  cancelled?: boolean;
}

let pluginInitialized = false;
let publishableKey: string | null = null;

const STRIPE_KEY_CACHE = 'cached-stripe-publishable-key';
// Restore from localStorage on module load
try {
  const cached = localStorage.getItem(STRIPE_KEY_CACHE);
  if (cached) publishableKey = cached;
} catch {}

/**
 * Check if native wallet payment is supported on this platform.
 */
export function isNativeWalletPlatform(): boolean {
  return ['ios', 'android'].includes(Capacitor.getPlatform());
}

/**
 * Get the Capacitor Stripe plugin. Tries the registered plugin object first
 * (works after `import '@capacitor-community/stripe'` has registered it via
 * `registerPlugin('Stripe', ...)`), then falls back to `Capacitor.Plugins.Stripe`
 * for older code paths.
 */
let cachedStripePlugin: any | null = null;
interface StripePluginHandle {
  plugin: any;
}

const stripePluginHandle = (plugin: any): StripePluginHandle => ({ plugin });

const withNativeTimeout = async <T,>(label: string, promise: Promise<T>, timeoutMs = 10000): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

async function getStripePlugin(): Promise<StripePluginHandle | null> {
  if (cachedStripePlugin) {
    console.log('[nativeStripePay] getStripePlugin: returning cached plugin handle');
    return stripePluginHandle(cachedStripePlugin);
  }
  if (!isNativeWalletPlatform()) {
    console.warn('[nativeStripePay] getStripePlugin: not a native platform (', Capacitor.getPlatform(), ')');
    return null;
  }
  try {
    console.log('[nativeStripePay] getStripePlugin: dynamic import @capacitor-community/stripe...');
    const mod = await import('@capacitor-community/stripe');
    console.log('[nativeStripePay] getStripePlugin: import result keys:', mod ? Object.keys(mod) : 'null');
    if (mod?.Stripe) {
      cachedStripePlugin = mod.Stripe;
      console.log('[nativeStripePay] getStripePlugin: ✅ resolved via package import. Methods:', Object.keys(mod.Stripe || {}));
      return stripePluginHandle(cachedStripePlugin);
    }
    console.warn('[nativeStripePay] getStripePlugin: package import returned no .Stripe export');
  } catch (e) {
    console.error('[nativeStripePay] getStripePlugin: ❌ dynamic import @capacitor-community/stripe failed:', e);
  }
  try {
    const plugins = (Capacitor as any).Plugins;
    console.log('[nativeStripePay] getStripePlugin: fallback Capacitor.Plugins keys:', plugins ? Object.keys(plugins) : 'none');
    if (plugins?.Stripe) {
      cachedStripePlugin = plugins.Stripe;
      console.log('[nativeStripePay] getStripePlugin: ✅ resolved via Capacitor.Plugins.Stripe');
      return stripePluginHandle(cachedStripePlugin);
    }
  } catch (e) {
    console.error('[nativeStripePay] getStripePlugin: Capacitor.Plugins access failed:', e);
  }
  console.error('[nativeStripePay] getStripePlugin: ❌ Stripe plugin not found anywhere');
  return null;
}

/**
 * Initialize the native Stripe plugin with the publishable key.
 * Call once — subsequent calls are no-ops.
 */
export async function initializeNativeStripe(): Promise<boolean> {
  if (!isNativeWalletPlatform()) return false;
  if (pluginInitialized) return true;

  const StripePlugin = (await getStripePlugin())?.plugin;
  if (!StripePlugin) {
    console.error('[nativeStripePay] Stripe Capacitor plugin not available (package import + Capacitor.Plugins both empty)');
    return false;
  }

  try {
    // Fetch publishable key if not cached
    if (!publishableKey) {
      console.log('[nativeStripePay] initializeNativeStripe: no cached key, fetching from get-public-keys...');
      try {
        const { data, error } = await supabase.functions.invoke('get-public-keys', {
          body: { key_type: 'STRIPE_PUBLISHABLE_KEY' },
        });
        if (error || !data?.key) {
          console.error('[nativeStripePay] ❌ Failed to fetch Stripe publishable key. error:', error, 'data:', data);
          return false;
        }
        publishableKey = data.key;
        console.log('[nativeStripePay] ✅ Stripe publishable key fetched. Mode:', publishableKey?.startsWith('pk_live') ? 'LIVE' : 'TEST');
        try { localStorage.setItem(STRIPE_KEY_CACHE, publishableKey); } catch {}
      } catch (e) {
        console.error('[nativeStripePay] ❌ Failed to fetch Stripe publishable key (exception):', e);
        return false;
      }
    } else {
      console.log('[nativeStripePay] initializeNativeStripe: using cached key. Mode:', publishableKey?.startsWith('pk_live') ? 'LIVE' : 'TEST');
    }

    console.log('[nativeStripePay] Calling StripePlugin.initialize()...');
    await withNativeTimeout('Stripe.initialize', StripePlugin.initialize({
      publishableKey,
      stripeAccount: undefined,
    }));

    pluginInitialized = true;
    console.log('[nativeStripePay] ✅ Native Stripe plugin initialized successfully');
    return true;
  } catch (err: any) {
    console.error('[nativeStripePay] ❌ Failed to initialize native Stripe:', {
      message: err?.message,
      code: err?.code,
      raw: err,
    });
    return false;
  }
}

/**
 * Cached availability check for the platform-native wallet (Apple Pay / Google Pay).
 * Returns true if the device + plugin can present the wallet sheet.
 */
let nativeWalletAvailable: boolean | null = null;

export async function isNativeWalletAvailable(): Promise<boolean> {
  if (!isNativeWalletPlatform()) return false;
  if (nativeWalletAvailable !== null) return nativeWalletAvailable;

  const ready = await initializeNativeStripe();
  if (!ready) {
    console.warn('[nativeStripePay] initializeNativeStripe returned false — wallet unavailable');
    nativeWalletAvailable = false;
    return false;
  }

  const StripePlugin = (await getStripePlugin())?.plugin;
  if (!StripePlugin) {
    nativeWalletAvailable = false;
    return false;
  }

  const platform = Capacitor.getPlatform();
  console.log('[nativeStripePay] isNativeWalletAvailable: probing', platform, '— plugin methods:', Object.keys(StripePlugin || {}));
  try {
    if (platform === 'ios') {
      if (typeof StripePlugin.isApplePayAvailable === 'function') {
        console.log('[nativeStripePay] Calling StripePlugin.isApplePayAvailable()...');
        const result = await withNativeTimeout('Stripe.isApplePayAvailable', StripePlugin.isApplePayAvailable(), 8000);
        console.log('[nativeStripePay] ✅ isApplePayAvailable() resolved. Result:', result);
        nativeWalletAvailable = true;
      } else {
        console.warn('[nativeStripePay] ⚠️ isApplePayAvailable method MISSING on plugin — assuming available');
        nativeWalletAvailable = true;
      }
    } else if (platform === 'android') {
      if (typeof StripePlugin.isGooglePayAvailable === 'function') {
        console.log('[nativeStripePay] Calling StripePlugin.isGooglePayAvailable()...');
        await withNativeTimeout('Stripe.isGooglePayAvailable', StripePlugin.isGooglePayAvailable(), 8000);
        nativeWalletAvailable = true;
      } else {
        nativeWalletAvailable = true;
      }
    } else {
      nativeWalletAvailable = false;
    }
  } catch (err: any) {
    console.error(`[nativeStripePay] ❌ ${platform} wallet unavailable. FULL ERROR:`, {
      message: err?.message,
      code: err?.code,
      data: err?.data,
      errorMessage: err?.errorMessage,
      stack: err?.stack,
      raw: JSON.stringify(err, Object.getOwnPropertyNames(err || {})),
    });
    console.error('[nativeStripePay] 💡 Common Apple Pay reasons it would reject:');
    console.error('  1. Apple Pay capability NOT enabled in Xcode target → Signing & Capabilities');
    console.error('  2. Merchant ID "merchant.sashiko.app" not created in Apple Developer account');
    console.error('  3. Merchant ID not associated with your Stripe account');
    console.error('  4. Running on iOS Simulator with no card in Wallet (Features → Wallet → Add Card)');
    console.error('  5. Device region/country does not support Apple Pay');
    nativeWalletAvailable = false;
  }

  console.log(`[nativeStripePay] 🏁 Final wallet availability on ${platform}:`, nativeWalletAvailable);
  return nativeWalletAvailable;
}


/**
 * Perform a native Apple Pay or Google Pay payment.
 * Creates a payment intent, presents the native wallet sheet,
 * then confirms the order on success.
 */
export async function nativeWalletPay(options: NativePayOptions): Promise<NativePayResult> {
  const platform = Capacitor.getPlatform();
  const StripePlugin = (await getStripePlugin())?.plugin;

  if (!StripePlugin) {
    return { success: false, error: 'Native payment plugin not available' };
  }

  if (!pluginInitialized) {
    const ok = await initializeNativeStripe();
    if (!ok) return { success: false, error: 'Failed to initialize payment system' };
  }

  try {
    // 1. Create payment intent via edge function
    const { data: piData, error: piError } = await supabase.functions.invoke('create-payment-intent', {
      body: {
        items: options.items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image_url: item.image_url,
        })),
        branch_id: options.branchId,
        order_type: options.orderType,
        delivery_address_id: options.deliveryAddressId,
        guest_info: options.guestInfo || null,
        estimated_delivery_time: options.scheduledDateTime || null,
        delivery_fee: options.deliveryFee,
        service_fee: options.serviceFee || 0,
        currency: options.currency,
        tax: options.tax,
        order_total: options.orderTotal,
      },
    });

    if (piError || !piData?.clientSecret) {
      return { success: false, error: 'Failed to create payment. Please try again.' };
    }

    const clientSecret = piData.clientSecret;
    const countryCode = options.countryCode || 'US';
    const currencyCode = options.currency.toUpperCase();

    // 2. Present native wallet sheet
    let walletResult: any;
    if (platform === 'ios') {
      await StripePlugin.createApplePay({
        paymentIntentClientSecret: clientSecret,
        paymentSummaryItems: [
          {
            label: options.merchantDisplayName || 'Order Total',
            amount: options.orderTotal,
          },
        ],
        merchantIdentifier: 'merchant.sashiko.app',
        countryCode,
        currency: currencyCode,
      });

      walletResult = await StripePlugin.presentApplePay();
      console.log('Apple Pay result:', walletResult);

    } else if (platform === 'android') {
      await StripePlugin.createGooglePay({
        paymentIntentClientSecret: clientSecret,
        paymentSummaryItems: [
          {
            label: options.merchantDisplayName || 'Order Total',
            amount: options.orderTotal,
          },
        ],
        merchantIdentifier: 'merchant.sashiko.app',
        countryCode,
        currency: currencyCode,
      });

      walletResult = await StripePlugin.presentGooglePay();
      console.log('Google Pay result:', walletResult);
    }

    // 2b. Check wallet result before proceeding
    const paymentResult = walletResult?.paymentResult;
    const completedResults = ['Completed', 'applePayCompleted', 'googlePayCompleted'];
    if (!paymentResult || !completedResults.includes(paymentResult)) {
      // Not a recognized success — treat as user cancellation (no error shown)
      return { success: false, cancelled: true };
    }

    // 3. Extract payment intent ID from client secret
    const paymentIntentId = clientSecret.split('_secret_')[0];

    // 4. Confirm order via edge function
    const { data: orderData, error: orderError } = await supabase.functions.invoke('confirm-payment', {
      body: {
        payment_intent_id: paymentIntentId,
        guest_address: options.orderType === 'delivery' ? (options.guestAddress || null) : null,
        guest_delivery_lat: options.orderType === 'delivery' ? (options.guestDeliveryLat || null) : null,
        guest_delivery_lng: options.orderType === 'delivery' ? (options.guestDeliveryLng || null) : null,
        item_instructions: options.items
          .filter(i => i.special_instructions)
          .map(i => ({ id: i.id, special_instructions: i.special_instructions })),
      },
    });

    if (orderError) {
      return { success: false, error: 'Order could not be finalized. Please contact support.' };
    }

    return {
      success: true,
      orderId: orderData?.order_id,
      orderNumber: orderData?.order_number,
    };

  } catch (err: any) {
    // User cancelled the wallet sheet
    const msg = (err?.message ?? '').toLowerCase();
    const code = (err?.code ?? '').toLowerCase();
    if (
      msg.includes('canceled') ||
      msg.includes('cancelled') ||
      msg.includes('cancel') ||
      code === 'err_canceled' ||
      code === 'payment_canceled' ||
      err?.type === 'canceled'
    ) {
      return { success: false, cancelled: true };
    }
    console.error('Native wallet payment error:', err);
    return { success: false, error: err?.message || 'Payment failed. Please try again.' };
  }
}
