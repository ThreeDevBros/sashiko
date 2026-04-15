import { useState, useEffect, useRef, useCallback } from 'react';
import { loadStripe, Stripe, StripeCardNumberElement } from '@stripe/stripe-js';
import { Check, CreditCard, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { CreditCardVisual } from './CreditCardVisual';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { getGlobalCurrency } from '@/lib/currency';

interface GuestCardPaymentProps {
  guestInfo: {
    name: string;
    email: string;
    phone: string;
  };
  guestAddress?: string;
  guestDeliveryLat?: number;
  guestDeliveryLng?: number;
  orderType: 'delivery' | 'pickup';
  branchId?: string;
  onSuccess: (orderId: string) => void;
  onValidityChange?: (valid: boolean) => void;
  submitRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  deliveryFee?: number;
  serviceFee?: number;
  tax?: number;
  orderTotal?: number;
}

const getStripeElementStyle = () => {
  const isDesktop = window.innerWidth >= 768;
  return {
    base: {
      fontSize: isDesktop ? '20px' : '15px',
      lineHeight: isDesktop ? '32px' : '24px',
      color: '#e0f2fe',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      '::placeholder': {
        color: 'rgba(100, 116, 139, 0.5)',
      },
      iconColor: '#94a3b8',
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  };
};

export const GuestCardPayment = ({
  guestInfo,
  guestAddress,
  guestDeliveryLat,
  guestDeliveryLng,
  orderType,
  branchId,
  onSuccess,
  onValidityChange,
  submitRef,
  deliveryFee = 0,
  serviceFee = 0,
  tax = 0,
  orderTotal = 0,
}: GuestCardPaymentProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { items, clearCart } = useCart();
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [cardNumberEl, setCardNumberEl] = useState<StripeCardNumberElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [numberComplete, setNumberComplete] = useState(false);
  const [expiryComplete, setExpiryComplete] = useState(false);
  const [cvcComplete, setCvcComplete] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [cardholderName, setCardholderName] = useState(guestInfo.name || '');

  const isFormValid = numberComplete && expiryComplete && cvcComplete && cardholderName.trim().length > 0;

  useEffect(() => {
    onValidityChange?.(isFormValid && !loading);
  }, [isFormValid, loading, onValidityChange]);

  useEffect(() => {
    const initStripe = async () => {
      try {
        const { data, error: keyError } = await supabase.functions.invoke('get-public-keys', {
          body: { key_type: 'STRIPE_PUBLISHABLE_KEY' },
        });

        if (keyError || !data?.key) {
          console.error('Error loading Stripe key:', keyError);
          toast({ title: 'Payment unavailable', description: 'Card payment is currently unavailable.', variant: 'destructive' });
          return;
        }

        const stripeInstance = await loadStripe(data.key);
        if (!stripeInstance) throw new Error('Failed to load Stripe');

        setStripe(stripeInstance);
        const elements = stripeInstance.elements();

        const style = getStripeElementStyle();
        const cardNumber = elements.create('cardNumber', { style, showIcon: true });
        const cardExpiry = elements.create('cardExpiry', { style });
        const cardCvc = elements.create('cardCvc', { style });

        setCardNumberEl(cardNumber);

        const numContainer = document.getElementById('guest-card-number');
        const expContainer = document.getElementById('guest-card-expiry');
        const cvcContainer = document.getElementById('guest-card-cvc');

        if (numContainer) cardNumber.mount('#guest-card-number');
        if (expContainer) cardExpiry.mount('#guest-card-expiry');
        if (cvcContainer) cardCvc.mount('#guest-card-cvc');

        cardNumber.on('change', (e) => { setNumberComplete(e.complete); setCardError(e.error?.message || null); });
        cardExpiry.on('change', (e) => { setExpiryComplete(e.complete); if (e.error) setCardError(e.error.message); });
        cardCvc.on('change', (e) => { setCvcComplete(e.complete); if (e.error) setCardError(e.error.message); });

        setMounted(true);
      } catch (error) {
        console.error('Error initializing Stripe:', error);
        toast({ title: 'Payment error', description: 'Failed to initialize payment.', variant: 'destructive' });
      }
    };
    initStripe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSubmittingRef = useRef(false);

  const handleSubmit = useCallback(async () => {
    if (!stripe || !cardNumberEl || !isFormValid || isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const { data: paymentData, error: piError } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          items: items.map(item => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity, image_url: item.image_url })),
          branch_id: branchId, order_type: orderType,
          guest_info: { name: guestInfo.name, email: guestInfo.email, phone: guestInfo.phone },
           delivery_fee: deliveryFee,
           service_fee: serviceFee,
           currency: getGlobalCurrency().toLowerCase(),
           tax: tax,
           order_total: orderTotal,
        }
      });
      if (piError) throw new Error(piError.message || 'Failed to create payment');
      if (!paymentData?.clientSecret) throw new Error('No client secret received');

      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(paymentData.clientSecret, {
        payment_method: { card: cardNumberEl, billing_details: { name: cardholderName, email: guestInfo.email, phone: guestInfo.phone } },
      });
      if (confirmError) throw new Error(confirmError.message || 'Payment failed');

      if (paymentIntent?.status === 'succeeded') {
        const { data: orderData, error: orderError } = await supabase.functions.invoke('confirm-payment', {
          body: {
            payment_intent_id: paymentIntent.id,
            guest_address: orderType === 'delivery' ? guestAddress : null,
            guest_delivery_lat: orderType === 'delivery' ? (guestDeliveryLat || null) : null,
            guest_delivery_lng: orderType === 'delivery' ? (guestDeliveryLng || null) : null,
          }
        });
        if (orderError) throw new Error(orderError.message || 'Failed to create order');
        toast({ title: 'Payment successful!', description: 'Your order has been placed.' });
        // Store guest order for tracking and history
        if (orderData?.order_id && guestInfo?.email) {
          const { addGuestOrder } = await import('@/lib/guestOrders');
          addGuestOrder({
            id: orderData.order_id,
            email: guestInfo.email,
            order_number: orderData.order_number || '',
            created_at: new Date().toISOString(),
          });
        }
        // Navigate FIRST, then clear cart to avoid empty-cart redirect race
        if (orderData?.order_id) onSuccess(orderData.order_id); else navigate('/order-history', { replace: true });
        clearCart();
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      let errorMessage = 'Please try again or use cash on delivery.';
      if (error.message && !error.message.includes('non-2xx') && !error.message.includes('Edge Function')) errorMessage = error.message;
      toast({ title: 'Payment failed', description: errorMessage, variant: 'destructive' });
    } finally { setLoading(false); isSubmittingRef.current = false; }
  }, [stripe, cardNumberEl, isFormValid, items, branchId, orderType, guestInfo, cardholderName, guestAddress, clearCart, navigate, onSuccess, toast, deliveryFee, serviceFee, tax, orderTotal]);

  useEffect(() => {
    if (submitRef) submitRef.current = handleSubmit;
  }, [submitRef, handleSubmit]);

  return (
    <div className="w-full mt-3 space-y-3">
      {/* Credit card visual */}
      <CreditCardVisual>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.87em' }}>
          {/* Cardholder Name */}
          <div>
            <label className="font-medium text-slate-400/70 uppercase tracking-wider block" style={{ fontSize: '0.8em', marginBottom: '0.3em' }}>
              Cardholder
            </label>
            <input
              type="text"
              placeholder="John Doe"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-[#e0f2fe] placeholder:text-slate-500/50 p-0"
              style={{ fontSize: '1.1em' }}
            />
          </div>

          {/* Card Number */}
          <div>
            <label className="font-medium text-slate-400/70 uppercase tracking-wider block" style={{ fontSize: '0.8em', marginBottom: '0.3em' }}>
              Card Number
            </label>
            <div id="guest-card-number" style={{ minHeight: '2em' }} />
          </div>

          {/* Expiry + CVC side by side */}
          <div className="flex" style={{ gap: '1.75em' }}>
            <div className="flex-1">
              <label className="font-medium text-slate-400/70 uppercase tracking-wider block" style={{ fontSize: '0.8em', marginBottom: '0.3em' }}>
                Expiry
              </label>
              <div id="guest-card-expiry" style={{ minHeight: '2em' }} />
            </div>
            <div className="flex-1">
              <label className="font-medium text-slate-400/70 uppercase tracking-wider block" style={{ fontSize: '0.8em', marginBottom: '0.3em' }}>
                CVC
              </label>
              <div id="guest-card-cvc" style={{ minHeight: '2em' }} />
            </div>
          </div>
        </div>
      </CreditCardVisual>

        {cardError && (
          <p className="text-destructive text-xs text-center">{cardError}</p>
        )}

        {isFormValid && (
          <div className="flex items-center justify-center gap-2 text-green-500 text-sm">
            <Check className="h-4 w-4" />
            <span>Card details complete</span>
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
          <Lock className="h-3 w-3" />
          <p className="text-xs">Secured with Stripe encryption</p>
        </div>
    </div>
  );
};
