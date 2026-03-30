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

/**
 * Check if native wallet payment is supported on this platform.
 */
export function isNativeWalletPlatform(): boolean {
  return ['ios', 'android'].includes(Capacitor.getPlatform());
}

/**
 * Get the Capacitor Stripe plugin via dynamic access to avoid web build issues.
 */
function getStripePlugin(): any | null {
  try {
    const plugins = (Capacitor as any).Plugins;
    return plugins?.Stripe || null;
  } catch {
    return null;
  }
}

/**
 * Initialize the native Stripe plugin with the publishable key.
 * Call once — subsequent calls are no-ops.
 */
export async function initializeNativeStripe(): Promise<boolean> {
  if (!isNativeWalletPlatform()) return false;
  if (pluginInitialized) return true;

  const StripePlugin = getStripePlugin();
  if (!StripePlugin) {
    console.error('Stripe Capacitor plugin not available');
    return false;
  }

  try {
    // Fetch publishable key if not cached
    if (!publishableKey) {
      const { data, error } = await supabase.functions.invoke('get-public-keys', {
        body: { key_type: 'STRIPE_PUBLISHABLE_KEY' },
      });
      if (error || !data?.key) {
        console.error('Failed to fetch Stripe publishable key');
        return false;
      }
      publishableKey = data.key;
    }

    await StripePlugin.initialize({
      publishableKey,
      stripeAccount: undefined,
    });

    pluginInitialized = true;
    console.log('Native Stripe plugin initialized');
    return true;
  } catch (err) {
    console.error('Failed to initialize native Stripe:', err);
    return false;
  }
}

/**
 * Perform a native Apple Pay or Google Pay payment.
 * Creates a payment intent, presents the native wallet sheet,
 * then confirms the order on success.
 */
export async function nativeWalletPay(options: NativePayOptions): Promise<NativePayResult> {
  const platform = Capacitor.getPlatform();
  const StripePlugin = getStripePlugin();

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
        currency: options.currency,
        tax: options.tax,
      },
    });

    if (piError || !piData?.clientSecret) {
      return { success: false, error: 'Failed to create payment. Please try again.' };
    }

    const clientSecret = piData.clientSecret;
    const countryCode = options.countryCode || 'US';
    const currencyCode = options.currency.toUpperCase();

    // 2. Present native wallet sheet
    if (platform === 'ios') {
      await StripePlugin.createApplePay({
        paymentIntentClientSecret: clientSecret,
        paymentSummaryItems: [
          {
            label: options.merchantDisplayName || 'Order Total',
            amount: options.orderTotal,
          },
        ],
        merchantIdentifier: 'merchant.app.lovable.6e0c6b4d4b7943e7a8431d08565d9c10',
        countryCode,
        currency: currencyCode,
      });

      const appleResult = await StripePlugin.presentApplePay();
      console.log('Apple Pay result:', appleResult);

    } else if (platform === 'android') {
      await StripePlugin.createGooglePay({
        paymentIntentClientSecret: clientSecret,
        paymentSummaryItems: [
          {
            label: options.merchantDisplayName || 'Order Total',
            amount: options.orderTotal,
          },
        ],
        merchantIdentifier: 'merchant.app.lovable.6e0c6b4d4b7943e7a8431d08565d9c10',
        countryCode,
        currency: currencyCode,
      });

      const googleResult = await StripePlugin.presentGooglePay();
      console.log('Google Pay result:', googleResult);
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
      return { success: false, error: 'Payment succeeded but order creation failed. Please contact support.' };
    }

    return {
      success: true,
      orderId: orderData?.order_id,
      orderNumber: orderData?.order_number,
    };

  } catch (err: any) {
    // User cancelled the wallet sheet
    if (
      err?.message?.includes('canceled') ||
      err?.message?.includes('cancelled') ||
      err?.code === 'ERR_CANCELED'
    ) {
      return { success: false, cancelled: true };
    }
    console.error('Native wallet payment error:', err);
    return { success: false, error: err?.message || 'Payment failed. Please try again.' };
  }
}
