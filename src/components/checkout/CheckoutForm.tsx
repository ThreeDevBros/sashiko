import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronRight, CreditCard, Banknote, Plus } from 'lucide-react';
import { ApplePayIcon, GooglePayIcon } from '@/components/icons/PaymentIcons';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { calculateDistance } from '@/lib/distance';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { AddCardForm } from './AddCardForm';
import { GuestCardPayment } from './GuestCardPayment';
import { useSavedCards } from '@/hooks/useSavedCards';

// Conditionally import Stripe hooks - they may not be available for guest checkout
let useStripe: any = () => null;
let useElements: any = () => null;
try {
  const stripeReact = require('@stripe/react-stripe-js');
  useStripe = stripeReact.useStripe;
  useElements = stripeReact.useElements;
} catch (e) {
  // Stripe not available, will use null
}

interface Branch {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  delivery_radius_km: number | null;
}
interface CheckoutFormProps {
  orderType: 'pickup' | 'delivery';
  onOrderTypeChange: (type: 'pickup' | 'delivery') => void;
  selectedAddressId: string | null;
  onAddressSelect: (addressId: string, locationData?: { latitude: number; longitude: number; address: string }) => void;
  branch: Branch | null;
  hasClientSecret?: boolean;
  canDeliver?: boolean;
  clientSecret?: string;
  isGuest?: boolean;
  guestInfo?: {
    name: string;
    email: string;
    phone: string;
  };
  guestAddress?: string;
  guestDeliveryLat?: number;
  guestDeliveryLng?: number;
  onPaymentTypeChange?: (type: 'card' | 'wallet' | 'cash') => void;
  cashbackAmount?: number;
  onGuestCardValidityChange?: (valid: boolean) => void;
  guestCardSubmitRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  orderInstructions?: string;
  scheduledDateTime?: string | null;
  deliveryFee?: number;
  onBeforeNavigate?: () => void;
  cashAllowed?: boolean;
  tax?: number;
}
export const CheckoutForm = ({
  orderType,
  onOrderTypeChange,
  selectedAddressId,
  onAddressSelect,
  branch,
  hasClientSecret = true,
  canDeliver = true,
  clientSecret,
  isGuest = false,
  guestInfo,
  guestAddress,
  guestDeliveryLat,
  guestDeliveryLng,
  onPaymentTypeChange,
  cashbackAmount = 0,
  onGuestCardValidityChange,
  guestCardSubmitRef,
  orderInstructions,
  scheduledDateTime,
  deliveryFee = 0,
  onBeforeNavigate,
  cashAllowed = true,
  tax = 0,
}: CheckoutFormProps) => {
  // Only use Stripe hooks when not in guest mode (when Elements wrapper is available)
  let stripe: any = null;
  let elements: any = null;
  
  try {
    stripe = useStripe();
    elements = useElements();
  } catch (e) {
    // Hooks not available (guest mode without Elements wrapper)
  }
  
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const {
    clearCart,
    items
  } = useCart();
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [distanceToAddress, setDistanceToAddress] = useState<number | null>(null);
  const [currentLocationData, setCurrentLocationData] = useState<{ latitude: number; longitude: number; address: string } | null>(null);
  const [paymentType, setPaymentType] = useState<'card' | 'wallet' | 'cash'>(cashAllowed ? 'cash' : 'card');
  const [isAddingNewCard, setIsAddingNewCard] = useState(false);
  const [showGuestCardForm, setShowGuestCardForm] = useState(false);

  // Notify parent when payment type changes
  useEffect(() => {
    onPaymentTypeChange?.(paymentType);
  }, [paymentType, onPaymentTypeChange]);
  
  // Wrapper function to handle address selection and capture location data
  const handleAddressSelect = (addressId: string, locationData?: { latitude: number; longitude: number; address: string }) => {
    if (locationData) {
      setCurrentLocationData(locationData);
    } else {
      setCurrentLocationData(null);
    }
    onAddressSelect(addressId, locationData);
  };
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false);
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState<string | null>(null);
  const [availableWallets, setAvailableWallets] = useState<{
    applePay: boolean;
    googlePay: boolean;
  }>({
    applePay: false,
    googlePay: false
  });
  const { savedCards: prefetchedCards, isLoading: cardsLoading, refreshCards } = useSavedCards();
  const [savedCards, setSavedCards] = useState<any[]>([]);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  // Sync prefetched cards into local state
  useEffect(() => {
    if (!cardsLoading && prefetchedCards.length > 0) {
      setSavedCards(prefetchedCards);
      setSelectedCard(prev => prev || prefetchedCards[0].id);
      setPaymentType('card');
    }
  }, [prefetchedCards, cardsLoading]);
  // Check available wallets - native iOS always gets Apple Pay
  useEffect(() => {
    if (isGuest) return;
    
    // On native iOS, Apple Pay is available via the device regardless of Stripe's web detection
    const isNativeIos = Capacitor.getPlatform() === 'ios';
    const isNativeAndroid = Capacitor.getPlatform() === 'android';
    
    if (isNativeIos) {
      setAvailableWallets({ applePay: true, googlePay: false });
      console.log('Native iOS detected - Apple Pay enabled');
      return;
    }
    
    if (isNativeAndroid) {
      setAvailableWallets({ applePay: false, googlePay: true });
      console.log('Native Android detected - Google Pay enabled');
      return;
    }

    if (!stripe) {
      console.log('Stripe is not loaded yet');
    } else {
      console.log('Stripe loaded successfully');

      // Detect available payment wallets via Stripe Payment Request API (web only)
      const checkWallets = async () => {
        try {
          const paymentRequest = stripe.paymentRequest({
            country: 'US',
            currency: 'usd',
            total: {
              label: 'Test',
              amount: 100
            }
          });
          const canMakePayment = await paymentRequest.canMakePayment();
          setAvailableWallets({
            applePay: canMakePayment?.applePay || false,
            googlePay: canMakePayment?.googlePay || false
          });
          console.log('Available wallets:', {
            applePay: canMakePayment?.applePay,
            googlePay: canMakePayment?.googlePay
          });
        } catch (error) {
          console.error('Error checking wallets:', error);
        }
      };
      checkWallets();
    }
  }, [stripe, isGuest]);

  // Load user's preferred payment method and saved cards (skip for guests)
  useEffect(() => {
    if (isGuest) {
      setPaymentType(cashAllowed ? 'cash' : 'card');
      return;
    }
    
    const loadPaymentData = async () => {
      try {
        const {
          data: {
            user
          }
        } = await supabase.auth.getUser();
        if (!user) return;
        
        // Load preferred payment method
        const {
          data,
          error
        } = await supabase.from('profiles').select('preferred_payment_method').eq('id', user.id).single();
        if (error) throw error;
        if (data?.preferred_payment_method) {
          setPreferredPaymentMethod(data.preferred_payment_method);
          console.log('Loaded preferred payment method:', data.preferred_payment_method);
        }

        // Saved cards are now prefetched via useSavedCards hook
        // If no cards loaded yet, default to cash
        if (!cardsLoading && prefetchedCards.length === 0) {
          setPaymentType(cashAllowed ? 'cash' : 'card');
        }
      } catch (error) {
        console.error('Error loading payment data:', error);
      }
    };
    loadPaymentData();
  }, [isGuest]);

  // Load selected address and calculate distance
  useEffect(() => {
    const loadAddress = async () => {
      if (!selectedAddressId || orderType !== 'delivery') {
        setSelectedAddress(null);
        setDistanceToAddress(null);
        return;
      }
      
      // Handle current location
      if (selectedAddressId === 'current-location') {
        if (currentLocationData && branch?.latitude && branch?.longitude) {
          const distance = calculateDistance(
            branch.latitude,
            branch.longitude,
            currentLocationData.latitude,
            currentLocationData.longitude
          );
          setDistanceToAddress(distance);
          setSelectedAddress({
            id: 'current-location',
            label: 'Current Location',
            address_line1: currentLocationData.address,
            city: '',
            latitude: currentLocationData.latitude,
            longitude: currentLocationData.longitude
          });
        }
        return;
      }
      
      try {
        const {
          data,
          error
        } = await supabase.from('user_addresses').select('*').eq('id', selectedAddressId).single();
        if (error) throw error;
        setSelectedAddress(data);
        
        // Calculate distance if branch and address have coordinates
        if (branch?.latitude && branch?.longitude && data.latitude && data.longitude) {
          const distance = calculateDistance(
            branch.latitude,
            branch.longitude,
            data.latitude,
            data.longitude
          );
          setDistanceToAddress(distance);
        } else {
          setDistanceToAddress(null);
        }
      } catch (error) {
        console.error('Error loading address:', error);
      }
    };
    loadAddress();
  }, [selectedAddressId, orderType, branch, currentLocationData]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Prevent duplicate submissions
    if (isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;

    // Validation for delivery
    if (orderType === 'delivery' && !selectedAddressId && !isGuest) {
      setError('Please select a delivery address');
      isSubmittingRef.current = false;
      return;
    }

    // Validation for delivery radius (only for non-guests with address)
    if (orderType === 'delivery' && !canDeliver && selectedAddressId) {
      toast({
        title: "Outside Delivery Zone",
        description: "Your address is outside our delivery zone. Please select pickup or choose a different address.",
        variant: "destructive"
      });
      setError('Address is outside delivery zone. Please select pickup instead.');
      isSubmittingRef.current = false;
      return;
    }
    
    // Validation for guest info
    if (isGuest && (!guestInfo?.name || !guestInfo?.email || !guestInfo?.phone)) {
      setError('Please fill in all guest information fields');
      isSubmittingRef.current = false;
      return;
    }
    
    // Validation for guest delivery address (uses currentLocationData from parent)
    if (isGuest && orderType === 'delivery' && !guestAddress?.trim()) {
      setError('Please set your delivery location using the location buttons');
      isSubmittingRef.current = false;
      return;
    }
    setLoading(true);
    try {
      if (paymentType === 'cash') {
        // Cash on delivery - create order directly without payment
        console.log('Creating cash on delivery order...');
        const {
          data: {
            user
          }
        } = await supabase.auth.getUser();

        // Create order via edge function
        const {
          data,
          error
        } = await supabase.functions.invoke('create-cash-order', {
          body: {
            order_type: orderType,
            delivery_address_id: (!isGuest && selectedAddressId && selectedAddressId !== 'current-location' && selectedAddressId !== 'selected-location') ? selectedAddressId : null,
            branch_id: branch?.id,
            items: items.map(item => ({
              id: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              special_instructions: item.special_instructions || undefined,
            })),
            guest_info: user ? null : guestInfo ? {
              name: guestInfo.name,
              email: guestInfo.email,
              phone: guestInfo.phone
            } : null,
            guest_address: orderType === 'delivery' ? (guestAddress || selectedAddress?.address_line1 || null) : null,
            guest_delivery_lat: orderType === 'delivery' ? (guestDeliveryLat || null) : null,
            guest_delivery_lng: orderType === 'delivery' ? (guestDeliveryLng || null) : null,
            cashback_used: cashbackAmount,
            special_instructions: orderInstructions?.trim() || null,
            estimated_delivery_time: scheduledDateTime || null,
            delivery_fee: orderType === 'delivery' ? deliveryFee : 0,
            tax: tax,
          }
        });
        if (error) {
          console.error('Order creation error:', error);
          throw error;
        }
        console.log('Cash order created:', data);
        toast({
          title: 'Order placed successfully',
          description: 'Please have exact cash ready for delivery'
        });
        // Store guest order for tracking and history
        if (!user && data?.order_id && guestInfo?.email) {
          const { addGuestOrder } = await import('@/lib/guestOrders');
          addGuestOrder({
            id: data.order_id,
            email: guestInfo.email,
            order_number: data.order_number || '',
            created_at: new Date().toISOString(),
          });
        }
        onBeforeNavigate?.();
        if (data?.order_id) {
          navigate(`/order-tracking/${data.order_id}`, { replace: true });
        } else {
          navigate('/order-history', { replace: true });
        }
        clearCart();
      } else {
        // Online payment via Stripe
        if (!stripe) {
          setError('Payment system is not ready. Please wait a moment and try again.');
          return;
        }
        
        console.log('Confirming online payment...');
        
        let paymentResult;
        
        // Check if using a saved card
        if (selectedCard && !isAddingNewCard) {
          // Use saved card with confirmCardPayment
          if (!clientSecret) {
            setError('Payment not initialized. Please refresh and try again.');
            return;
          }
          console.log('Paying with saved card:', selectedCard);
          paymentResult = await stripe.confirmCardPayment(clientSecret, {
            payment_method: selectedCard,
          });
        } else {
          // Use PaymentElement with confirmPayment
          if (!elements) {
            setError('Payment form is not ready. Please wait a moment and try again.');
            return;
          }
          paymentResult = await stripe.confirmPayment({
            elements,
            redirect: 'if_required',
            confirmParams: {
              return_url: `${window.location.origin}/checkout/success`
            }
          });
        }
        
        const { error: stripeError, paymentIntent } = paymentResult;
        
        if (stripeError) {
          console.error('Stripe error:', stripeError);
          setError(stripeError.message || 'Payment failed');
          throw new Error(stripeError.message);
        }
        if (paymentIntent && paymentIntent.status === 'succeeded') {
          console.log('Payment succeeded, creating order...');

          // Save payment method preference
          const paymentMethodType = paymentIntent.payment_method_types?.[0] || 'card';
          try {
            const {
              data: {
                user
              }
            } = await supabase.auth.getUser();
            if (user) {
              await supabase.from('profiles').update({
                preferred_payment_method: paymentMethodType
              }).eq('id', user.id);
              console.log('Saved payment preference:', paymentMethodType);
            }
          } catch (error) {
            console.error('Error saving payment preference:', error);
          }

          // Create order in database
          const {
            data,
            error
          } = await supabase.functions.invoke('confirm-payment', {
            body: {
              payment_intent_id: paymentIntent.id,
              guest_address: orderType === 'delivery' && (!selectedAddressId || selectedAddressId === 'current-location' || selectedAddressId === 'selected-location')
                ? (guestAddress || selectedAddress?.address_line1 || null)
                : null,
              guest_delivery_lat: orderType === 'delivery' ? (guestDeliveryLat || null) : null,
              guest_delivery_lng: orderType === 'delivery' ? (guestDeliveryLng || null) : null,
              item_instructions: items
                .filter(item => item.special_instructions)
                .map(item => ({ id: item.id, special_instructions: item.special_instructions })),
            }
          });
          if (error) {
            console.error('Order creation error:', error);
            throw error;
          }
          console.log('Order created:', data);

          // Store guest order for tracking
          if (guestInfo?.email && data?.order_id) {
            const { addGuestOrder } = await import('@/lib/guestOrders');
            addGuestOrder({
              id: data.order_id,
              email: guestInfo.email,
              order_number: data.order_number || '',
              created_at: new Date().toISOString(),
            });
          }
          onBeforeNavigate?.();
          if (data?.order_id) {
            navigate(`/order-tracking/${data.order_id}`, { replace: true });
          } else {
            navigate('/order-history', { replace: true });
          }
          clearCart();
        }
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      // Extract a user-friendly message
      let errorMessage = 'We couldn\'t process your payment. Please try again.';
      if (error.message && !error.message.includes('non-2xx') && !error.message.includes('Edge Function')) {
        errorMessage = error.message;
      }
      setError(errorMessage);
      toast({
        title: 'Payment failed',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };
  return <form onSubmit={handleSubmit} className="space-y-6">
      {error && <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>}

      <div className="space-y-4">
          
          {/* Payment Method Drawer - Always visible so user can switch */}
          {(
          <Drawer open={isPaymentDrawerOpen} onOpenChange={setIsPaymentDrawerOpen}>
            <DrawerTrigger asChild>
              <button 
                type="button"
                className="w-full touch-manipulation flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-card hover:bg-accent/50 cursor-pointer transition-all duration-300 text-left"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                  {paymentType === 'cash' ? <Banknote className="h-5 w-5 text-primary" /> : paymentType === 'wallet' ? <Smartphone className="h-5 w-5 text-primary" /> : <CreditCard className="h-5 w-5 text-primary" />}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">
                    {paymentType === 'cash' ? 'Cash' : paymentType === 'wallet' ? availableWallets.applePay ? 'Apple Pay' : 'Google Pay' : selectedCard ? 'Saved Card' : 'Credit/Debit Card'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {paymentType === 'cash' ? 'Pay on delivery' : paymentType === 'wallet' ? 'Digital wallet' : 'Card payment'}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </DrawerTrigger>
            
            <DrawerContent className="z-[100]">
              <DrawerHeader>
                <DrawerTitle>Select Payment Method</DrawerTitle>
                <DrawerDescription>Choose how you'd like to pay</DrawerDescription>
              </DrawerHeader>
              
              <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto overscroll-contain" data-vaul-no-drag>
                {/* Saved Cards Section - Only for logged-in users */}
                {!isGuest && savedCards.length > 0 && <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Saved Cards</h3>
                    {savedCards.map(card => <button 
                      key={card.id} 
                      type="button"
                      data-vaul-no-drag
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPaymentType('card');
                        setSelectedCard(card.id);
                        setIsAddingNewCard(false);
                        setIsPaymentDrawerOpen(false);
                      }} 
                      className={`w-full touch-manipulation flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all text-left pointer-events-auto ${selectedCard === card.id && !isAddingNewCard ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-accent/50'}`}
                    >
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                          <CreditCard className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">•••• {card.last4}</p>
                          <p className="text-xs text-muted-foreground">{card.brand} • Expires {card.exp_month}/{card.exp_year}</p>
                        </div>
                        {selectedCard === card.id && !isAddingNewCard && <ChevronRight className="h-5 w-5 text-primary" />}
                      </button>)}
                  </div>}

                <div className="space-y-2">
                  {!isGuest && savedCards.length > 0 && <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Payment</h3>}
                  
                  <button 
                    type="button"
                    data-vaul-no-drag
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPaymentType('card');
                      setSelectedCard(null);
                      if (isGuest) {
                        setShowGuestCardForm(true);
                      } else {
                        setIsAddingNewCard(true);
                      }
                      setIsPaymentDrawerOpen(false);
                    }} 
                    className={`w-full touch-manipulation flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all text-left pointer-events-auto ${paymentType === 'card' && !selectedCard ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-accent/50'}`}
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                      {isGuest ? <CreditCard className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">
                        {isGuest ? 'Credit/Debit Card' : savedCards.length > 0 ? 'Add New Card' : 'Add Credit/Debit Card'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isGuest ? 'Secure one-time payment' : 'Visa, Mastercard, Amex'}
                      </p>
                    </div>
                    {paymentType === 'card' && !selectedCard && <ChevronRight className="h-5 w-5 text-primary" />}
                  </button>
                </div>

                {/* Digital Wallets - Only for logged-in users */}
                {!isGuest && (availableWallets.applePay || availableWallets.googlePay) && <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Digital Wallets</h3>
                    
                    {availableWallets.applePay && <button 
                      type="button"
                      data-vaul-no-drag
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPaymentType('wallet');
                        setSelectedCard(null);
                        setIsPaymentDrawerOpen(false);
                      }} 
                      className={`w-full touch-manipulation flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all text-left pointer-events-auto ${paymentType === 'wallet' && availableWallets.applePay ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-accent/50'}`}
                    >
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                          <Smartphone className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">Apple Pay</p>
                          <p className="text-xs text-muted-foreground">Pay with Apple Pay</p>
                        </div>
                        {paymentType === 'wallet' && availableWallets.applePay && <ChevronRight className="h-5 w-5 text-primary" />}
                      </button>}

                    {availableWallets.googlePay && <button 
                      type="button"
                      data-vaul-no-drag
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPaymentType('wallet');
                        setSelectedCard(null);
                        setIsPaymentDrawerOpen(false);
                      }} 
                      className={`w-full touch-manipulation flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all text-left pointer-events-auto ${paymentType === 'wallet' && availableWallets.googlePay && !availableWallets.applePay ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-accent/50'}`}
                    >
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                          <Smartphone className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">Google Pay</p>
                          <p className="text-xs text-muted-foreground">Pay with Google Pay</p>
                        </div>
                        {paymentType === 'wallet' && availableWallets.googlePay && !availableWallets.applePay && <ChevronRight className="h-5 w-5 text-primary" />}
                      </button>}
                  </div>}

                {/* Cash Option - Only show if allowed for this branch + order type */}
                {cashAllowed && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Other Methods</h3>
                  
                  <button 
                    type="button"
                    data-vaul-no-drag
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPaymentType('cash');
                      setSelectedCard(null);
                      setIsAddingNewCard(false);
                      setShowGuestCardForm(false);
                      setIsPaymentDrawerOpen(false);
                    }} 
                    className={`w-full touch-manipulation flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all text-left pointer-events-auto ${paymentType === 'cash' ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-accent/50'}`}
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                      <Banknote className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Cash</p>
                      <p className="text-xs text-muted-foreground">Pay on delivery</p>
                    </div>
                    {paymentType === 'cash' && <ChevronRight className="h-5 w-5 text-primary" />}
                  </button>
                </div>
                )}
              </div>
              
              <DrawerFooter className="pt-2">
                <DrawerClose asChild>
                  <Button variant="outline" className="w-full touch-manipulation">Cancel</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
          )}

          {/* Guest Card Form - shown below drawer when guest selects card */}
          {isGuest && showGuestCardForm && paymentType === 'card' && (
            <GuestCardPayment
              guestInfo={guestInfo || { name: '', email: '', phone: '' }}
              guestAddress={guestAddress}
              guestDeliveryLat={guestDeliveryLat}
              guestDeliveryLng={guestDeliveryLng}
              orderType={orderType}
              branchId={branch?.id}
              onSuccess={(orderId) => {
                onBeforeNavigate?.();
                navigate(`/order-tracking/${orderId}`, { replace: true });
              }}
              onValidityChange={onGuestCardValidityChange}
              submitRef={guestCardSubmitRef}
              deliveryFee={deliveryFee}
              tax={tax}
            />
          )}

          {/* Credit Card Form - Show when adding a new card (not for guests) */}
          {!isGuest && isAddingNewCard && paymentType === 'card' && (
            <AddCardForm 
              onSuccess={async () => {
                await refreshCards();
                setIsAddingNewCard(false);
              }}
              onCancel={() => {
                setIsAddingNewCard(false);
                setPaymentType('cash');
              }}
            />
          )}
      </div>

      


      {orderType === 'delivery' && !selectedAddressId && !isGuest && <p className="text-sm text-destructive text-center">
          Please select a delivery address
        </p>}

    </form>;
};