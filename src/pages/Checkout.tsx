import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import googleMapsIcon from '@/assets/google-maps-icon.png';
import { fetchDeliveryFeeConfig, calculateDeliveryFee, type DeliveryFeeConfig } from '@/lib/deliveryFee';
import { Card } from "@/components/ui/card";
import { ChevronLeft, Bike, ShoppingBag, Clock, Loader2, Navigation, Coins, CalendarIcon, AlertTriangle as AlertTriangleIcon, MapPin, MapPinned, Store, Info } from "lucide-react";
import { format, addDays } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { useNavigate } from "react-router-dom";
import { useCart } from '@/contexts/CartContext';
import { useBranding } from '@/hooks/useBranding';
import { useBranch } from '@/hooks/useBranch';
import { isBranchOpen, formatBranchTime } from '@/lib/branch';
import { formatCurrency } from '@/lib/currency';
import { FloatingBranchWidget } from '@/components/FloatingBranchWidget';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { DeliveryMap } from '@/components/checkout/DeliveryMap';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useDeliveryValidation } from '@/hooks/useDeliveryValidation';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, Check, ExternalLink } from "lucide-react";
import { BackButton } from '@/components/BackButton';
import { GuestCheckoutForm } from '@/components/checkout/GuestCheckoutForm';
import { Switch } from "@/components/ui/switch";
import { validateGuestCheckout, type GuestValidationErrors } from '@/lib/guestValidation';
import { STORAGE_KEYS } from '@/constants';
import { getAddressIcon } from '@/lib/addressIcons';
import { calculateDistance } from '@/lib/distance';
import { AddressSearchInput } from '@/components/checkout/AddressSearchInput';
import { PinDropMapOverlay } from '@/components/PinDropMapOverlay';
import { BranchInfoSheet } from '@/components/checkout/BranchInfoSheet';
import { useTranslation } from 'react-i18next';
import type { PlaceResult } from '@/components/LocationAutocompleteInput';

type LocationSourceType = 'device' | 'saved' | 'search' | 'pin';

const Checkout = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items } = useCart();
  const { branding } = useBranding();
  const { branch } = useBranch();
  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryTiming, setDeliveryTiming] = useState<'standard' | 'schedule'>('standard');
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [scheduleError, setScheduleError] = useState<string>('');
  const [branchCashSettings, setBranchCashSettings] = useState<{ allow_cash_pickup: boolean; allow_cash_delivery: boolean } | null>(null);

  // Compute scheduled datetime ISO string for passing to order creation
  const scheduledDateTime = deliveryTiming === 'schedule' && scheduledDate && scheduledTime
    ? (() => {
        const [h, m] = scheduledTime.split(':').map(Number);
        const dt = new Date(scheduledDate);
        dt.setHours(h, m, 0, 0);
        return dt.toISOString();
      })()
    : null;

  // --- Location state ---
  // selectedAddressId: 'current-location' | 'selected-location' | saved-address-uuid
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  // Source tracking for the active selection
  const [locationSource, setLocationSource] = useState<LocationSourceType>('device');
  // Device location (from GPS)
  const [deviceLocationData, setDeviceLocationData] = useState<{ latitude: number; longitude: number; address: string } | null>(null);
  // Selected location (from search/pin)
  const [selectedLocationData, setSelectedLocationData] = useState<{ latitude: number; longitude: number; address: string } | null>(null);

  const [addresses, setAddresses] = useState<Array<{
    id: string;
    label: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    postal_code?: string;
    is_default: boolean;
    latitude?: number;
    longitude?: number;
  }>>([]);
  const [clientSecret, setClientSecret] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [pinMapOpen, setPinMapOpen] = useState(false);
  const [branchInfoOpen, setBranchInfoOpen] = useState(false);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [stripeReady, setStripeReady] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const locationAttemptedRef = useRef(false);
  const isPlacingOrderRef = useRef(false);
  const [guestInfo, setGuestInfo] = useState({ name: '', email: '', phone: '' });
  
  const paymentTypeRef = useRef<'card' | 'wallet' | 'cash'>('cash');
  const [currentPaymentType, setCurrentPaymentType] = useState<'card' | 'wallet' | 'cash'>('cash');
  const [buttonText, setButtonText] = useState({ loading: t('checkout.placingOrder'), action: t('checkout.placeOrder') });
  const [cashbackBalance, setCashbackBalance] = useState<number>(0);
  const [useCashback, setUseCashback] = useState(false);
  const [guestCardValid, setGuestCardValid] = useState(false);
  const [guestValidationErrors, setGuestValidationErrors] = useState<GuestValidationErrors>({});
  const guestCardSubmitRef = useRef<(() => Promise<void>) | null>(null);
  const [orderInstructions, setOrderInstructions] = useState('');
  const [deliveryFeeConfig, setDeliveryFeeConfig] = useState<DeliveryFeeConfig | null>(null);
  const {
    canDeliver: loggedInCanDeliver,
    distance,
    loading: validationLoading
  } = useDeliveryValidation();

  // Reset duplicate-submission guard when loading finishes
  useEffect(() => {
    if (!loading) isPlacingOrderRef.current = false;
  }, [loading]);

  const activeLocation = useMemo(() => {
    if (selectedAddressId === 'current-location' && deviceLocationData) {
      return deviceLocationData;
    }
    if (selectedAddressId === 'selected-location' && selectedLocationData) {
      return selectedLocationData;
    }
    if (selectedAddressId && selectedAddressId !== 'current-location' && selectedAddressId !== 'selected-location') {
      const addr = addresses.find(a => a.id === selectedAddressId);
      if (addr?.latitude && addr?.longitude) {
        return { latitude: addr.latitude, longitude: addr.longitude, address: `${addr.address_line1}, ${addr.city}` };
      }
    }
    return null;
  }, [selectedAddressId, deviceLocationData, selectedLocationData, addresses]);

  // --- Delivery eligibility ---
  const hasDeliveryLocation = !!activeLocation;

  const deliveryDistance = useMemo(() => {
    if (!activeLocation || !branch?.latitude || !branch?.longitude) return null;
    return calculateDistance(
      branch.latitude, branch.longitude,
      activeLocation.latitude, activeLocation.longitude
    );
  }, [activeLocation, branch]);

  const deliveryRadiusKm = branch?.delivery_radius_km || 10;
  const isWithinRadius = deliveryDistance !== null ? deliveryDistance <= deliveryRadiusKm : true;

  const canDeliver = orderType !== 'delivery' ? true :
    (!hasDeliveryLocation ? false : isWithinRadius);

  const branchIsOpen = branch ? isBranchOpen(branch.opens_at, branch.closes_at) : true;
  const branchIsPaused = branch?.is_paused === true;

  // Load schedule window + delivery fee config from tenant_settings
  const [scheduleMinDays, setScheduleMinDays] = useState(0);
  const [scheduleMaxDays, setScheduleMaxDays] = useState(7);

  const handlePaymentTypeChange = useCallback((type: 'card' | 'wallet' | 'cash', walletType?: 'applePay' | 'googlePay') => {
    paymentTypeRef.current = type;
    setCurrentPaymentType(type);

    if (type === 'cash') {
      setButtonText({ loading: 'Placing Order...', action: 'Place Order' });
      return;
    }

    if (type === 'wallet') {
      const label = walletType === 'applePay' ? 'Apple Pay' : 'Google Pay';
      setButtonText({ loading: 'Processing Payment...', action: `Pay with ${label}` });
      return;
    }

    setButtonText({ loading: 'Processing Payment...', action: 'Pay Now' });
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      const config = await fetchDeliveryFeeConfig();
      if (config) setDeliveryFeeConfig(config);

      const { data } = await supabase
        .from('tenant_settings')
        .select('schedule_min_days, schedule_max_days')
        .limit(1)
        .maybeSingle();
      if (data) {
        setScheduleMinDays((data as any).schedule_min_days ?? 0);
        setScheduleMaxDays((data as any).schedule_max_days ?? 7);
      }
    };
    loadSettings();
  }, []);

  // Load branch cash payment settings
  useEffect(() => {
    if (!branch?.id) return;
    const loadCashSettings = async () => {
      const { data } = await supabase
        .from('branches')
        .select('allow_cash_pickup, allow_cash_delivery')
        .eq('id', branch.id)
        .single();
      if (data) {
        setBranchCashSettings({
          allow_cash_pickup: (data as any).allow_cash_pickup ?? true,
          allow_cash_delivery: (data as any).allow_cash_delivery ?? true,
        });
      }
    };
    loadCashSettings();
  }, [branch?.id]);

  // Determine if cash is allowed for current order type + branch
  const cashAllowed = useMemo(() => {
    if (!branchCashSettings) return true;
    return orderType === 'pickup' ? branchCashSettings.allow_cash_pickup : branchCashSettings.allow_cash_delivery;
  }, [branchCashSettings, orderType]);

  // Load Stripe publishable key in the background so wallet readiness can be accurately gated
  // On native platforms, also initialize the Capacitor Stripe plugin
  useEffect(() => {
    if (stripePromise) return; // Already loaded
    const loadStripeKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-public-keys', {
          body: { key_type: 'STRIPE_PUBLISHABLE_KEY' },
        });
        if (error) throw error;
        if (data?.key) {
          const promise = loadStripe(data.key);
          setStripePromise(promise);
          promise.then((s) => { if (s) setStripeReady(true); });

          // On native platforms, initialize the Capacitor Stripe plugin independently
          const { isNativeWalletPlatform, initializeNativeStripe } = await import('@/lib/nativeStripePay');
          if (isNativeWalletPlatform()) {
            const nativeOk = await initializeNativeStripe();
            if (nativeOk) {
              setStripeReady(true);
              console.log('Native Stripe plugin ready — wallet payments enabled');
            }
          }
        }
      } catch (error) {
        console.error('Error loading Stripe key:', error);
        toast.error('Failed to initialize payment system');
      }
    };
    loadStripeKey();
  }, [stripePromise]);

  // Calculate totals with per-item tax
  const globalTaxRate = branding?.vat_rate ?? 10;
  
  const { subtotal, tax } = useMemo(() => {
    let subtotalSum = 0;
    let taxSum = 0;
    
    for (const item of items) {
      const itemTaxRate = item.tax_rate ?? globalTaxRate;
      const lineTotal = item.price * item.quantity;
      
      if (item.tax_included_in_price) {
        // Price includes tax — extract tax from price
        const taxAmount = lineTotal - (lineTotal / (1 + itemTaxRate / 100));
        subtotalSum += lineTotal - taxAmount;
        taxSum += taxAmount;
      } else {
        // Price excludes tax — add tax on top
        subtotalSum += lineTotal;
        taxSum += lineTotal * (itemTaxRate / 100);
      }
    }
    
    return { subtotal: subtotalSum, tax: taxSum };
  }, [items, globalTaxRate]);
  
  const serviceFeeRate = (branding as any)?.service_fee_rate ?? 5;
  const serviceFee = subtotal * (serviceFeeRate / 100);
  const deliveryFee = orderType === 'delivery' && deliveryFeeConfig && deliveryDistance !== null
    ? calculateDeliveryFee(deliveryDistance, deliveryFeeConfig, subtotal)
    : orderType === 'delivery' && deliveryFeeConfig
      ? deliveryFeeConfig.delivery_base_fee
      : orderType === 'delivery' ? 0 : 0;
  const totalBeforeCashback = subtotal + serviceFee + deliveryFee + tax;
  const cashbackDiscount = useCashback ? Math.min(cashbackBalance, totalBeforeCashback) : 0;
  const grandTotal = totalBeforeCashback - cashbackDiscount;
  const currency = branding?.currency || 'USD';

  // Load user's cashback balance
  useEffect(() => {
    const loadCashback = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('cashback_balance')
        .eq('id', user.id)
        .single();
      if (profile) setCashbackBalance((profile as any).cashback_balance || 0);
    };
    loadCashback();
  }, []);

  // Guard: don't redirect away after successful checkout
  const isNavigatingAway = useRef(false);

  // Check auth and load unified delivery address
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsGuest(!user);
      setAuthChecked(true);
      
      if (!locationAttemptedRef.current) {
        locationAttemptedRef.current = true;
        
        const savedDeliveryAddress = localStorage.getItem(STORAGE_KEYS.DELIVERY_ADDRESS);
        
        // Load device location data
        const savedDeviceData = localStorage.getItem(STORAGE_KEYS.CURRENT_LOCATION_DATA);
        if (savedDeviceData) {
          try {
            const parsed = JSON.parse(savedDeviceData);
            if (parsed.latitude && parsed.longitude) {
              setDeviceLocationData(parsed);
            }
          } catch {}
        }

        // Load selected location data (search/pin)
        const savedSelectedData = localStorage.getItem(STORAGE_KEYS.SELECTED_LOCATION_DATA);
        if (savedSelectedData) {
          try {
            const parsed = JSON.parse(savedSelectedData);
            if (parsed.latitude && parsed.longitude && parsed.address) {
              setSelectedLocationData(parsed);
            }
          } catch {}
        }
        
        if (savedDeliveryAddress === 'current-location') {
          setSelectedAddressId('current-location');
          setLocationSource('device');
        } else if (savedDeliveryAddress === 'selected-location') {
          setSelectedAddressId('selected-location');
          setLocationSource('search');
        } else if (savedDeliveryAddress) {
          setSelectedAddressId(savedDeliveryAddress);
          setLocationSource('saved');
        }
      }
    };
    checkAuth();
  }, []);

  // Load addresses
  useEffect(() => {
    const loadAddresses = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from('user_addresses')
          .select('*')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false });
        if (error) throw error;
        setAddresses(data || []);

        const savedAddressId = localStorage.getItem(STORAGE_KEYS.DELIVERY_ADDRESS);
        if (savedAddressId === 'current-location' || savedAddressId === 'selected-location') {
          // Already loaded
        } else if (savedAddressId && data && data.find(a => a.id === savedAddressId)) {
          setSelectedAddressId(savedAddressId);
          setLocationSource('saved');
        } else if (!selectedAddressId && data && data.length > 0) {
          const defaultAddr = data.find(a => a.is_default) || data[0];
          setSelectedAddressId(defaultAddr.id);
          setLocationSource('saved');
          localStorage.setItem(STORAGE_KEYS.DELIVERY_ADDRESS, defaultAddr.id);
        }
      } catch (error) {
        console.error('Error loading addresses:', error);
      }
    };

    const handleAddressChange = () => {
      const savedAddressId = localStorage.getItem(STORAGE_KEYS.DELIVERY_ADDRESS);
      if (savedAddressId === 'current-location') {
        const savedDeviceData = localStorage.getItem(STORAGE_KEYS.CURRENT_LOCATION_DATA);
        if (savedDeviceData) {
          try { setDeviceLocationData(JSON.parse(savedDeviceData)); } catch {}
        }
        setSelectedAddressId('current-location');
        setLocationSource('device');
      } else if (savedAddressId === 'selected-location') {
        const savedSelectedData = localStorage.getItem(STORAGE_KEYS.SELECTED_LOCATION_DATA);
        if (savedSelectedData) {
          try { setSelectedLocationData(JSON.parse(savedSelectedData)); } catch {}
        }
        setSelectedAddressId('selected-location');
        setLocationSource('search');
      } else if (savedAddressId) {
        setSelectedAddressId(savedAddressId);
        setLocationSource('saved');
      }
    };
    
    window.addEventListener('addressChanged', handleAddressChange);
    if (orderType === 'delivery') loadAddresses();
    return () => window.removeEventListener('addressChanged', handleAddressChange);
  }, [orderType]);

  // Create payment intent - only when card payment is selected
  useEffect(() => {
    if (currentPaymentType !== 'card') return;
    const createPaymentIntent = async () => {
      if (!branch || items.length === 0) return;
      if (orderType === 'delivery' && !selectedAddressId && !isGuest) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setLoading(true);
      try {
        const { data: addressData } = orderType === 'delivery' && selectedAddressId && selectedAddressId !== 'current-location' && selectedAddressId !== 'selected-location'
          ? await supabase.from('user_addresses').select('*').eq('id', selectedAddressId).maybeSingle()
          : { data: null };
        const response = await supabase.functions.invoke('create-payment-intent', {
          body: {
            items: items.map(item => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity, image_url: item.image_url, special_instructions: item.special_instructions || undefined })),
            branch_id: branch.id,
            order_type: orderType,
            delivery_address_id: selectedAddressId,
            estimated_delivery_time: scheduledDateTime || null,
            delivery_fee: deliveryFee,
            currency: (currency || 'USD').toLowerCase(),
            tax: tax,
          }
        });
        if (response.error) {
          let errorMessage = 'Failed to initialize payment';
          try {
            if (response.error.message) errorMessage = response.error.message;
            if ((response.error as any).context?.body) {
              const errorBody = JSON.parse(await (response.error as any).context.body);
              if (errorBody.error) errorMessage = errorBody.error;
            }
          } catch {}
          console.error('Payment intent error details:', { status: (response.error as any)?.status, message: errorMessage });
          toast.error(errorMessage);
          return;
        }
        setClientSecret(response.data.clientSecret);
      } catch (error: any) {
        console.error('Error creating payment intent:', error);
        toast.error('Failed to initialize payment. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    createPaymentIntent();
  }, [branch, orderType, selectedAddressId, items, isGuest, currentPaymentType]);
  
  // --- Device location handler ---
  const useDeviceLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setGettingLocation(true);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const { data, error } = await supabase.functions.invoke('geocode-location', {
            body: { latitude, longitude }
          });

          let addressString = 'Current Location';
          if (!error && data?.address) addressString = data.address;

          const locationData = { latitude, longitude, address: addressString };
          setDeviceLocationData(locationData);
          setSelectedAddressId('current-location');
          setLocationSource('device');
          
          localStorage.setItem(STORAGE_KEYS.DELIVERY_ADDRESS, 'current-location');
          localStorage.setItem(STORAGE_KEYS.CURRENT_LOCATION_DATA, JSON.stringify(locationData));
          setAddressDialogOpen(false);
          window.dispatchEvent(new Event('addressChanged'));
          toast.success('Using your current location for delivery');
        } catch (error) {
          console.error('Error getting location:', error);
          toast.error('Failed to get your location. Please try again.');
        } finally {
          setGettingLocation(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast.error('Could not get your location. Please check your permissions.');
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // --- Search/Pin location handler ---
  const setSearchOrPinLocation = useCallback((result: { latitude: number; longitude: number; address: string }, source: 'search' | 'pin') => {
    const locData = { latitude: result.latitude, longitude: result.longitude, address: result.address };
    setSelectedLocationData(locData);
    setSelectedAddressId('selected-location');
    setLocationSource(source);
    localStorage.setItem(STORAGE_KEYS.DELIVERY_ADDRESS, 'selected-location');
    localStorage.setItem(STORAGE_KEYS.SELECTED_LOCATION_DATA, JSON.stringify(locData));
    window.dispatchEvent(new Event('addressChanged'));
  }, []);

  const handleOpenPinMap = () => {
    setAddressDialogOpen(false);
    setTimeout(() => setPinMapOpen(true), 300);
  };

  if (items.length === 0) return null;

  // --- Render helpers ---
  const renderDeliveryAddressCard = () => {
    if (selectedAddressId === 'current-location' && deviceLocationData) {
      return (
        <div 
          className="flex items-start gap-3 p-3 rounded-lg border border-border bg-accent/5 cursor-pointer hover:bg-accent/10 transition-colors"
          onClick={() => setAddressDialogOpen(true)}
        >
          <Navigation className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-foreground">Current Location</p>
            <p className="text-sm text-muted-foreground">{deviceLocationData.address}</p>
          </div>
          <ChevronLeft className="h-5 w-5 rotate-180 text-muted-foreground" />
        </div>
      );
    }
    if (selectedAddressId === 'selected-location' && selectedLocationData) {
      return (
        <div 
          className="flex items-start gap-3 p-3 rounded-lg border border-border bg-accent/5 cursor-pointer hover:bg-accent/10 transition-colors"
          onClick={() => setAddressDialogOpen(true)}
        >
          <MapPinned className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-foreground">Selected Location</p>
            <p className="text-sm text-muted-foreground">{selectedLocationData.address}</p>
          </div>
          <ChevronLeft className="h-5 w-5 rotate-180 text-muted-foreground" />
        </div>
      );
    }
    if (selectedAddressId && selectedAddressId !== 'current-location' && selectedAddressId !== 'selected-location') {
      const selectedAddress = addresses.find(a => a.id === selectedAddressId);
      if (selectedAddress) {
        const SelectedAddressIcon = getAddressIcon(selectedAddress.label, false);
        return (
          <div 
            className="flex items-start gap-3 p-3 rounded-lg border border-border bg-accent/5 cursor-pointer hover:bg-accent/10 transition-colors"
            onClick={() => setAddressDialogOpen(true)}
          >
            <SelectedAddressIcon className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-foreground">{selectedAddress.label}</p>
              <p className="text-sm text-muted-foreground">
                {selectedAddress.address_line1}
                {selectedAddress.address_line2 && `, ${selectedAddress.address_line2}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedAddress.city} {selectedAddress.postal_code}
              </p>
            </div>
            <ChevronLeft className="h-5 w-5 rotate-180 text-muted-foreground" />
          </div>
        );
      }
    }
    return (
      <div 
        className="flex items-center justify-between p-3 rounded-lg border border-border cursor-pointer hover:bg-accent/5 transition-colors"
        onClick={() => setAddressDialogOpen(true)}
      >
        <p className="text-sm text-muted-foreground">{isGuest ? 'Set Delivery Location' : 'Add Delivery Address'}</p>
        <ChevronLeft className="h-5 w-5 rotate-180 text-muted-foreground" />
      </div>
    );
  };

  return <div className="min-h-screen bg-background pb-32">
      <FloatingBranchWidget />
      
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <BackButton />
          <div className="flex-1 text-center">
            <h1 className="text-xl font-bold text-foreground">{branch?.name || branding?.tenant_name || 'Checkout'}</h1>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Map + Branch Strip merged container */}
        {(orderType === 'delivery' && hasDeliveryLocation || orderType === 'pickup' && branch?.latitude && branch?.longitude) && (
          <div>

            {/* Delivery map */}
            {orderType === 'delivery' && hasDeliveryLocation && (
              <Card className="p-4 relative">
                <button
                  onClick={() => setBranchInfoOpen(true)}
                  className="absolute top-6 right-6 z-[5] w-8 h-8 rounded-full bg-card/90 backdrop-blur border border-border shadow-md flex items-center justify-center hover:bg-accent transition-colors"
                >
                  <Info className="w-4 h-4 text-foreground" />
                </button>
                <DeliveryMap 
                  key={`delivery-${activeLocation?.latitude ?? 0},${activeLocation?.longitude ?? 0},${branch?.id ?? ''}`}
                  selectedAddressId={selectedAddressId} 
                  addresses={addresses} 
                  restaurantLocation={branch && branch.latitude && branch.longitude ? {
                    latitude: branch.latitude,
                    longitude: branch.longitude,
                    name: branch.name
                  } : undefined} 
                  deliveryRadiusKm={branch?.delivery_radius_km ?? undefined} 
                  showRadiusRing={!canDeliver && hasDeliveryLocation} 
                />
              </Card>
            )}

            {/* Pickup map */}
            {orderType === 'pickup' && branch?.latitude && branch?.longitude && (
              <Card className="p-4 rounded-b-none border-b-0 relative">
                <button
                  onClick={() => setBranchInfoOpen(true)}
                  className="absolute top-6 right-6 z-[5] w-8 h-8 rounded-full bg-card/90 backdrop-blur border border-border shadow-md flex items-center justify-center hover:bg-accent transition-colors"
                >
                  <Info className="w-4 h-4 text-foreground" />
                </button>
                <DeliveryMap
                  key={`pickup-${branch.id}-${branch.latitude}-${branch.longitude}`}
                  selectedAddressId={null}
                  addresses={[]}
                  restaurantLocation={{
                    latitude: branch.latitude,
                    longitude: branch.longitude,
                    name: branch.name
                  }}
                  pickupMode
                />
              </Card>
            )}

          </div>
        )}

        {/* Order Type */}
        <Card className="p-4" data-section="order-type">
          <h2 className="font-semibold mb-4">{t('checkout.orderType')}</h2>
          <RadioGroup value={orderType} onValueChange={(value: any) => setOrderType(value)}>
            <div className="flex gap-4">
              <Label htmlFor="delivery" className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                orderType === 'delivery' ? 'border-primary bg-primary/5' : 'border-border'
              }`}>
                <RadioGroupItem value="delivery" id="delivery" />
                <Bike className="h-5 w-5" />
                <span className="font-medium">{t('checkout.delivery')}</span>
              </Label>
              
              <Label htmlFor="pickup" data-order-type="pickup" className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${orderType === 'pickup' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <RadioGroupItem value="pickup" id="pickup" />
                <ShoppingBag className="h-5 w-5" />
                <span className="font-medium">{t('checkout.pickup')}</span>
              </Label>
            </div>
          </RadioGroup>

          {/* Branch paused warning */}
          {branchIsPaused && (
            <Alert className="mt-4 border-destructive/50 bg-destructive/10 text-destructive [&>svg]:text-destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This branch is currently busy and not accepting orders. Please wait and try again shortly.
              </AlertDescription>
            </Alert>
          )}

          {/* Branch closed warning */}
          {!branchIsPaused && !branchIsOpen && deliveryTiming === 'standard' && (
            <Alert className="mt-4 border-destructive/50 bg-destructive/10 text-destructive [&>svg]:text-destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This branch is currently closed. You can schedule your order for later or try again during operating hours
                {branch?.opens_at && branch?.closes_at && ` (${formatBranchTime(branch.opens_at)} - ${formatBranchTime(branch.closes_at)})`}.
              </AlertDescription>
            </Alert>
          )}

          {/* No location selected warning */}
          {orderType === 'delivery' && !hasDeliveryLocation && (
            <Alert className="mt-4 border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 [&>svg]:text-yellow-600 dark:[&>svg]:text-yellow-400">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No delivery location selected yet. Please set your delivery address to continue to payment.
              </AlertDescription>
            </Alert>
          )}

          {/* Delivery radius warning */}
          {!canDeliver && hasDeliveryLocation && orderType === 'delivery' && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Delivery isn't available for this address (outside our delivery area). 
                Please change your address if you're not at the selected location.
              </AlertDescription>
            </Alert>
          )}
        </Card>

        {/* Delivery Address Display */}
        {orderType === 'delivery' && (
          <Card className="p-4" data-section="delivery-address">
            <h2 className="font-semibold mb-3">{t('checkout.deliveryAddress')}</h2>
            {renderDeliveryAddressCard()}
          </Card>
        )}
        
        {/* Address Selection Dialog */}
        <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
          <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('checkout.selectDeliveryAddress')}</DialogTitle>
            </DialogHeader>

            {/* Google Places Search (includes pin-on-map button) */}
            <AddressSearchInput
              onAddressSelected={(result) => {
                setSearchOrPinLocation(result, 'search');
                setAddressDialogOpen(false);
              }}
              onPinMapClick={handleOpenPinMap}
            />

            <div className="space-y-3">
              {/* Device Location Option */}
              <button
                type="button"
                className={`w-full flex items-start gap-3 rounded-lg border p-4 transition-colors cursor-pointer text-left ${
                  selectedAddressId === 'current-location'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent/5'
                }`}
                onClick={() => useDeviceLocation()}
              >
                <Navigation className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Use Device Location</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {gettingLocation ? 'Getting location...' : 
                     (selectedAddressId === 'current-location' && deviceLocationData) 
                       ? deviceLocationData.address 
                       : 'Automatically detect your location'}
                  </p>
                </div>
                {gettingLocation && <Loader2 className="h-4 w-4 animate-spin mt-1" />}
                {selectedAddressId === 'current-location' && !gettingLocation && (
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                )}
              </button>

              {/* Selected Location (from search/pin) */}
              {selectedLocationData && (
                <button
                  type="button"
                  className={`w-full flex items-start gap-3 rounded-lg border p-4 transition-colors cursor-pointer text-left ${
                    selectedAddressId === 'selected-location'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent/5'
                  }`}
                  onClick={() => {
                    setSelectedAddressId('selected-location');
                    setLocationSource(locationSource === 'pin' ? 'pin' : 'search');
                    localStorage.setItem(STORAGE_KEYS.DELIVERY_ADDRESS, 'selected-location');
                    window.dispatchEvent(new Event('addressChanged'));
                    setAddressDialogOpen(false);
                  }}
                >
                  <MapPinned className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">Selected Location</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {selectedLocationData.address}
                    </p>
                  </div>
                  {selectedAddressId === 'selected-location' && (
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  )}
                </button>
              )}

              {/* Saved Addresses divider */}
              {!isGuest && addresses.length > 0 && (
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Saved Addresses</span>
                  </div>
                </div>
              )}

              {/* Saved Addresses */}
              {!isGuest && addresses.map(address => {
                const isSelected = selectedAddressId === address.id;
                const AddressIconComp = getAddressIcon(address.label, false);
                return (
                  <button
                    key={address.id}
                    type="button"
                    className={`w-full flex items-start gap-3 rounded-lg border p-4 transition-colors cursor-pointer text-left ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/5'
                    }`}
                    onClick={() => {
                      setSelectedAddressId(address.id);
                      setLocationSource('saved');
                      localStorage.setItem(STORAGE_KEYS.DELIVERY_ADDRESS, address.id);
                      window.dispatchEvent(new Event('addressChanged'));
                      setAddressDialogOpen(false);
                    }}
                  >
                    <AddressIconComp className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-foreground">{address.label}</span>
                        {address.is_default && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {address.address_line1}, {address.city}
                      </p>
                    </div>
                    {isSelected && <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            {!isGuest && (
              <Button onClick={() => {
                setAddressDialogOpen(false);
                navigate('/profile/address');
              }} variant="outline" className="w-full">
                Manage Addresses
              </Button>
            )}
          </DialogContent>
        </Dialog>

        {/* Pin Drop Map Overlay */}
        <PinDropMapOverlay
          open={pinMapOpen}
          onClose={() => setPinMapOpen(false)}
          onConfirm={(place: PlaceResult) => {
            setPinMapOpen(false);
            setSearchOrPinLocation({ latitude: place.latitude, longitude: place.longitude, address: place.address }, 'pin');
            toast.success('Location pinned successfully');
          }}
        />

        {/* Order Instructions */}
        <Card className="p-4">
          <h2 className="font-semibold mb-3">{t('checkout.orderInstructions')} <span className="text-muted-foreground font-normal text-sm">({t('checkout.orderInstructionsOptional')})</span></h2>
          <textarea
            value={orderInstructions}
            onChange={(e) => setOrderInstructions(e.target.value.slice(0, 300))}
            placeholder="e.g. Gate code, floor, ring the bell, leave at the door, call when outside…"
            maxLength={300}
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 resize-none max-h-32 overflow-y-auto"
          />
          <p className="text-xs text-muted-foreground text-right mt-1">{orderInstructions.length}/300</p>
        </Card>

        {/* When */}
        <Card className="p-4">
          <h2 className="font-semibold mb-4">{t('checkout.when')}</h2>
          <RadioGroup value={deliveryTiming} onValueChange={(value: any) => {
            setDeliveryTiming(value);
            if (value === 'standard') setScheduleError('');
          }}>
            <div className="space-y-3">
              <Label htmlFor="standard" className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-colors ${deliveryTiming === 'standard' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="standard" id="standard" />
                  <Clock className="h-5 w-5" />
                  <div>
                    <p className="font-medium">{t('checkout.standardOrder')}</p>
                    <p className="text-sm text-muted-foreground">{t('checkout.estimatedTime')}</p>
                  </div>
                </div>
              </Label>
              
              <div>
                <Label htmlFor="schedule" className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-colors ${deliveryTiming === 'schedule' ? 'border-primary bg-primary/5' : 'border-border'} ${deliveryTiming === 'schedule' ? 'rounded-b-none' : ''}`}>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="schedule" id="schedule" />
                    <Clock className="h-5 w-5" />
                    <span className="font-medium">{t('checkout.scheduleForLater')}</span>
                  </div>
                  <ChevronLeft className={`h-5 w-5 text-muted-foreground transition-transform ${deliveryTiming === 'schedule' ? 'rotate-90' : 'rotate-180'}`} />
                </Label>

                <Collapsible open={deliveryTiming === 'schedule'}>
                  <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-up-2 data-[state=open]:slide-down-2">
                    <div className="border-2 border-t-0 border-primary rounded-b-lg p-4 bg-primary/5 space-y-4">
                      <h3 className="text-base font-bold">
                        {orderType === 'delivery'
                          ? 'Pick Date & Time for Delivery'
                          : `Pick Date & Time for Pickup at ${branch?.name || ''}`}
                      </h3>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Select Date</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={`w-full justify-start text-left font-normal ${!scheduledDate ? 'text-muted-foreground' : ''}`}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {scheduledDate ? format(scheduledDate, 'PPP') : 'Pick a date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 z-50" align="start">
                            <Calendar
                              mode="single"
                              selected={scheduledDate}
                              onSelect={(date) => { setScheduledDate(date); setScheduleError(''); }}
                              disabled={(date) => { const today = new Date(); today.setHours(0,0,0,0); const minDate = addDays(today, scheduleMinDays); const maxDate = addDays(today, scheduleMaxDays); return date < minDate || date > maxDate; }}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Select Time</label>
                        <Input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => { setScheduledTime(e.target.value); setScheduleError(''); }}
                          className="w-full"
                        />
                        {branch?.opens_at && branch?.closes_at && (
                          <p className="text-xs text-muted-foreground">
                            Working hours: {formatBranchTime(branch.opens_at)} - {formatBranchTime(branch.closes_at)}
                          </p>
                        )}
                      </div>

                      {scheduleError && (
                        <Alert className="border-destructive/50 bg-destructive/10 text-destructive [&>svg]:text-destructive">
                          <AlertTriangleIcon className="h-4 w-4" />
                          <AlertDescription>{scheduleError}</AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>
          </RadioGroup>
        </Card>

        {/* Guest Info Form */}
        {isGuest && (
          <GuestCheckoutForm 
            guestInfo={guestInfo} 
            onGuestInfoChange={(info) => { setGuestInfo(info); setGuestValidationErrors({}); }}
            errors={guestValidationErrors}
          />
        )}

        {/* Payment */}
        <Card className="p-4">
          <h2 className="font-semibold mb-4">{t('checkout.paymentMethod')}</h2>
          
          {!authChecked ? (
            <div className="flex justify-center py-8">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            </div>
          ) : isGuest ? (
            (() => {
              const guestCheckoutForm = (
                <CheckoutForm 
                  orderType={orderType} 
                  onOrderTypeChange={setOrderType} 
                  selectedAddressId={selectedAddressId} 
                  onAddressSelect={(addressId, locationData) => {
                    if (locationData) setSelectedLocationData(locationData);
                    setSelectedAddressId(addressId);
                  }} 
                  branch={branch} 
                  hasClientSecret={false} 
                  canDeliver={canDeliver}
                  isGuest={true}
                  guestInfo={guestInfo}
                  guestAddress={activeLocation?.address || ''}
                  guestDeliveryLat={activeLocation?.latitude}
                  guestDeliveryLng={activeLocation?.longitude}
                  onPaymentTypeChange={handlePaymentTypeChange}
                  cashbackAmount={0}
                  onGuestCardValidityChange={setGuestCardValid}
                  guestCardSubmitRef={guestCardSubmitRef}
                  orderInstructions={orderInstructions}
                  scheduledDateTime={scheduledDateTime}
                  deliveryFee={deliveryFee}
                  onBeforeNavigate={() => { isNavigatingAway.current = true; }}
                  cashAllowed={cashAllowed}
                  tax={tax}
                  orderTotal={grandTotal}
                  walletSystemReady={stripeReady}
                />
              );
              // Wrap in Elements when wallet is selected so useStripe() works for guests
              if (currentPaymentType === 'wallet' && stripePromise) {
                return <Elements stripe={stripePromise}>{guestCheckoutForm}</Elements>;
              }
              return guestCheckoutForm;
            })()
          ) : stripePromise && clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm 
                orderType={orderType} 
                onOrderTypeChange={setOrderType} 
                selectedAddressId={selectedAddressId} 
                onAddressSelect={(addressId, locationData) => {
                  if (locationData) setSelectedLocationData(locationData);
                  setSelectedAddressId(addressId);
                }} 
                branch={branch} 
                hasClientSecret={!!clientSecret} 
                canDeliver={canDeliver}
                clientSecret={clientSecret}
                onPaymentTypeChange={handlePaymentTypeChange}
                cashbackAmount={cashbackDiscount}
                guestAddress={activeLocation?.address || ''}
                guestDeliveryLat={activeLocation?.latitude}
                guestDeliveryLng={activeLocation?.longitude}
                orderInstructions={orderInstructions}
                scheduledDateTime={scheduledDateTime}
                deliveryFee={deliveryFee}
                onBeforeNavigate={() => { isNavigatingAway.current = true; }}
                 cashAllowed={cashAllowed}
                 tax={tax}
                 orderTotal={grandTotal}
                 walletSystemReady={stripeReady}
               />
            </Elements>
          ) : (
            currentPaymentType === 'wallet' && stripePromise ? (
              <Elements stripe={stripePromise}>
                <CheckoutForm 
                  orderType={orderType} 
                  onOrderTypeChange={setOrderType} 
                  selectedAddressId={selectedAddressId} 
                  onAddressSelect={(addressId, locationData) => {
                    if (locationData) setSelectedLocationData(locationData);
                    setSelectedAddressId(addressId);
                  }} 
                  branch={branch} 
                  hasClientSecret={false} 
                  canDeliver={canDeliver}
                  onPaymentTypeChange={handlePaymentTypeChange}
                  cashbackAmount={cashbackDiscount}
                  guestAddress={activeLocation?.address || ''}
                  guestDeliveryLat={activeLocation?.latitude}
                  guestDeliveryLng={activeLocation?.longitude}
                  orderInstructions={orderInstructions}
                  scheduledDateTime={scheduledDateTime}
                  deliveryFee={deliveryFee}
                  onBeforeNavigate={() => { isNavigatingAway.current = true; }}
                  cashAllowed={cashAllowed}
                  tax={tax}
                  orderTotal={grandTotal}
                  walletSystemReady={stripeReady}
                />
              </Elements>
            ) : (
              <CheckoutForm 
              orderType={orderType} 
              onOrderTypeChange={setOrderType} 
              selectedAddressId={selectedAddressId} 
              onAddressSelect={(addressId, locationData) => {
                if (locationData) setSelectedLocationData(locationData);
                setSelectedAddressId(addressId);
              }} 
              branch={branch} 
              hasClientSecret={false} 
              canDeliver={canDeliver}
              onPaymentTypeChange={handlePaymentTypeChange}
              cashbackAmount={cashbackDiscount}
              guestAddress={activeLocation?.address || ''}
              guestDeliveryLat={activeLocation?.latitude}
              guestDeliveryLng={activeLocation?.longitude}
              orderInstructions={orderInstructions}
              scheduledDateTime={scheduledDateTime}
              deliveryFee={deliveryFee}
              onBeforeNavigate={() => { isNavigatingAway.current = true; }}
               cashAllowed={cashAllowed}
               tax={tax}
               orderTotal={grandTotal}
               walletSystemReady={stripeReady}
             />
            )
          )}
        </Card>

        {/* Summary */}
        <Card className="p-4">
          <h2 className="font-semibold mb-4">{t('checkout.summary')}</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('checkout.subtotal')}</span>
              <span>{formatCurrency(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('checkout.serviceFee')}</span>
              <span>{formatCurrency(serviceFee, currency)}</span>
            </div>
            {orderType === 'delivery' && <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('checkout.deliveryFee')}</span>
                <span className={deliveryFee === 0 && deliveryFeeConfig?.free_delivery_threshold ? 'text-green-600 dark:text-green-400 font-medium' : ''}>
                  {deliveryFee === 0 && deliveryFeeConfig?.free_delivery_threshold ? t('checkout.freeDelivery') : formatCurrency(deliveryFee, currency)}
                </span>
              </div>}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('checkout.tax')}</span>
              <span>{formatCurrency(tax, currency)}</span>
            </div>
            
            {/* Cashback Redemption */}
            {!isGuest && cashbackBalance > 0 && (
              <div className="border-t pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">{t('checkout.useCashback')}</span>
                    <span className="text-xs text-muted-foreground">
                      (Available: {formatCurrency(cashbackBalance, currency)})
                    </span>
                  </div>
                  <Switch checked={useCashback} onCheckedChange={setUseCashback} />
                </div>
                {useCashback && (
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>{t('checkout.cashbackDiscount')}</span>
                    <span>-{formatCurrency(cashbackDiscount, currency)}</span>
                  </div>
                )}
              </div>
            )}
            
            <div className="border-t pt-3 flex justify-between font-bold">
              <span>{t('checkout.grandTotal')}</span>
              <span>{formatCurrency(grandTotal, currency)}</span>
            </div>
          </div>
          
          {validationLoading && orderType === 'delivery' ? <Button className="w-full mt-4" size="lg" disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking delivery zone...
            </Button> : <Button size="lg" onClick={() => {
          // Prevent duplicate submissions from rapid clicks
          if (isPlacingOrderRef.current || loading) return;
          isPlacingOrderRef.current = true;

          // Reset the guard after a short delay to allow re-attempts on validation failures
          const resetGuard = () => { isPlacingOrderRef.current = false; };

          // --- Branch Paused: block order ---
          if (branchIsPaused) {
            toast.error('This branch is currently busy and not accepting orders. Please try again shortly.');
            resetGuard();
            return;
          }

          // --- Branch Closed: scroll to order type area + highlight ---
          if (deliveryTiming === 'standard' && !branchIsOpen) {
            const orderTypeCard = document.querySelector('[data-section="order-type"]');
            if (orderTypeCard) {
              orderTypeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
              orderTypeCard.classList.add('ring-2', 'ring-destructive', 'ring-offset-2');
              setTimeout(() => orderTypeCard.classList.remove('ring-2', 'ring-destructive', 'ring-offset-2'), 3000);
            }
            toast.error('This branch is currently closed. Please schedule for later or try during operating hours.');
            resetGuard();
            return;
          }

          // --- Delivery location missing ---
          if (orderType === 'delivery' && !selectedAddressId) {
            const deliverySection = document.querySelector('[data-section="delivery-address"]');
            if (deliverySection) {
              deliverySection.scrollIntoView({ behavior: 'smooth', block: 'center' });
              deliverySection.classList.add('ring-2', 'ring-destructive', 'ring-offset-2');
              setTimeout(() => deliverySection.classList.remove('ring-2', 'ring-destructive', 'ring-offset-2'), 3000);
            }
            toast.error('Please set your delivery location to continue.');
            resetGuard();
            return;
          }

          // --- Delivery out of range ---
          if (orderType === 'delivery' && !canDeliver && !!selectedAddressId) {
            toast.error('Your selected location is outside our delivery area. Please choose a different address or switch to Pickup.');
            resetGuard();
            return;
          }

          // Schedule validation
          if (deliveryTiming === 'schedule') {
            if (!scheduledDate || !scheduledTime) {
              setScheduleError('Please select both a date and time for your scheduled order.');
              resetGuard();
              return;
            }
            const now = new Date();
            const isToday = scheduledDate.toDateString() === now.toDateString();
            if (isToday) {
              const [h, m] = scheduledTime.split(':').map(Number);
              const scheduledMinutes = h * 60 + m;
              const currentMinutes = now.getHours() * 60 + now.getMinutes();
              if (scheduledMinutes <= currentMinutes) {
                setScheduleError('Please select a future time.');
                resetGuard();
                return;
              }
            }
            if (branch?.opens_at && branch?.closes_at) {
              const [h, m] = scheduledTime.split(':').map(Number);
              const timeMinutes = h * 60 + m;
              const [oh, om] = branch.opens_at.split(':').map(Number);
              const [ch, cm] = branch.closes_at.split(':').map(Number);
              const openMinutes = oh * 60 + om;
              const closeMinutes = ch * 60 + cm;
              if (closeMinutes <= openMinutes) {
                if (timeMinutes < openMinutes && timeMinutes >= closeMinutes) {
                  setScheduleError(`Please select a time within working hours (${branch.opens_at} - ${branch.closes_at}).`);
                  resetGuard();
                  return;
                }
              } else {
                if (timeMinutes < openMinutes || timeMinutes >= closeMinutes) {
                  setScheduleError(`Please select a time within working hours (${branch.opens_at} - ${branch.closes_at}).`);
                  resetGuard();
                  return;
                }
              }
            }
          }

          // --- Guest validation: scroll + red borders + focus ---
          if (isGuest) {
            const result = validateGuestCheckout({
              name: guestInfo.name,
              email: guestInfo.email,
              phone: guestInfo.phone,
              orderType,
              hasDeliveryLocation,
            });
            if (!result.isValid) {
              setGuestValidationErrors(result.errors);
              const firstField = result.errors.name ? 'guest-name' 
                : result.errors.email ? 'guest-email' 
                : result.errors.phone ? 'guest-phone' 
                : null;
              if (firstField) {
                setTimeout(() => {
                  const el = document.getElementById(firstField);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.focus();
                  }
                }, 50);
              }
              resetGuard();
              return;
            }
          }

          // If guest + card payment, use the guest card submit handler
          if (isGuest && currentPaymentType === 'card' && guestCardSubmitRef.current) {
            guestCardSubmitRef.current();
            // Don't reset guard here - let the submission complete
            return;
          }
          const form = document.querySelector('form');
          if (form) form.requestSubmit();
          // The form's handleSubmit will manage its own guard
        }} disabled={loading || isPlacingOrderRef.current || (currentPaymentType === 'wallet' && !stripeReady)}
        className={`w-full mt-4 ${
          (!loading && (
            branchIsPaused ||
            (deliveryTiming === 'standard' && !branchIsOpen) ||
            (orderType === 'delivery' && !selectedAddressId) ||
            (orderType === 'delivery' && !canDeliver && !!selectedAddressId) ||
            (isGuest && currentPaymentType === 'card' && !guestCardValid) ||
            (currentPaymentType === 'wallet' && !stripeReady) ||
            (isGuest && (!guestInfo.name.trim() || guestInfo.name.trim().length < 2 || !guestInfo.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestInfo.email.trim()) || !guestInfo.phone.trim()))
          )) ? 'opacity-50' : ''
        }`}>
              {loading ? <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {buttonText.loading}
                </> : branchIsPaused ? 'Branch Busy' : (!branchIsOpen && deliveryTiming === 'standard') ? 'Branch Closed' : buttonText.action}
            </Button>}

        </Card>
      </div>
      <BranchInfoSheet branch={branch} open={branchInfoOpen} onOpenChange={setBranchInfoOpen} />
    </div>;
};
export default Checkout;
