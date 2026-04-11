import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Phone, MapPin, Store, Clock, Navigation, Coins, ExternalLink, AlertTriangle, XCircle, CheckCircle2, ChefHat } from 'lucide-react';
import googleMapsIcon from '@/assets/google-maps-icon.png';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { BackButton } from '@/components/BackButton';
import LoadingScreen from '@/components/LoadingScreen';
import { useBranding } from '@/hooks/useBranding';
import { useTheme } from '@/components/ThemeProvider';
import { OrderProgressTracker } from '@/components/order/OrderProgressTracker';
import { OrderTrackingMap } from '@/components/order/OrderTrackingMap';
import { LiveOrderCountdown } from '@/components/order/LiveOrderCountdown';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';
import { getGuestOrders } from '@/lib/guestOrders';
import { areLiveActivitiesSupported, startOrderLiveActivity, updateOrderLiveActivity, endOrderLiveActivity } from '@/lib/nativeLiveActivity';
import { useAppLifecycle } from '@/hooks/useAppLifecycle';

interface Order {
  id: string;
  order_number: string;
  status: string;
  order_type: 'delivery' | 'pickup' | 'dine_in';
  created_at: string;
  estimated_delivery_time: string | null;
  estimated_ready_at: string | null;
  delivery_address_id: string | null;
  branch_id: string | null;
  subtotal: number;
  tax: number | null;
  delivery_fee: number | null;
  total: number;
  guest_name: string | null;
  guest_phone: string | null;
  guest_delivery_address: string | null;
  guest_delivery_lat: number | null;
  guest_delivery_lng: number | null;
  cancellation_reason: string | null;
}

interface Address {
  id: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
}

interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  latitude?: number;
  longitude?: number;
}

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  menu_item: {
    name: string;
    image_url: string | null;
  } | null;
}

export default function OrderTracking() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { branding } = useBranding();
  const { theme } = useTheme();
  const { user, isAuthReady } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [cashbackRate, setCashbackRate] = useState<number>(0);
  const hasShownCashbackToast = useRef(false);
  const [allowCustomerCancel, setAllowCustomerCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [guestDriverLocation, setGuestDriverLocation] = useState<{
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    updated_at: string;
  } | null>(null);

  // Refetch on app resume (native background → foreground)
  useAppLifecycle(() => {
    if (orderId) loadOrderDetails();
  });

  useEffect(() => {
    if (!isAuthReady) return;
    loadOrderDetails();
    loadCashbackRate();
  }, [orderId, isAuthReady]);

  // Helper to compute ETA minutes
  const computeEtaMinutes = useCallback((o: Order | null): number | null => {
    if (!o?.estimated_ready_at) return null;
    const diffMs = new Date(o.estimated_ready_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diffMs / 60000));
  }, []);

  // Start/update/end iOS Live Activity when order loads or status changes
  const liveActivityStarted = useRef(false);
  useEffect(() => {
    console.log('[LiveActivity] useEffect fired — order:', order?.id, 'status:', order?.status, 'isGuest:', isGuest);
    if (!order || isGuest) return;
    const isActive = !['delivered', 'cancelled'].includes(order.status);

    const laData = {
      orderId: order.id,
      orderNumber: order.order_number,
      orderType: order.order_type,
      status: order.status,
      statusMessage: getStatusMessage(),
      etaMinutes: computeEtaMinutes(order),
    };

    if (isActive && !liveActivityStarted.current) {
      areLiveActivitiesSupported().then(supported => {
        if (!supported) return;
        startOrderLiveActivity(laData);
        liveActivityStarted.current = true;
      });
    } else if (isActive && liveActivityStarted.current) {
      // Update existing activity with new status/ETA
      updateOrderLiveActivity(laData);
    } else if (!isActive && liveActivityStarted.current) {
      endOrderLiveActivity(order.id);
      liveActivityStarted.current = false;
    }
  }, [order?.id, order?.status, isGuest]);

  // Subscribe to real-time order status updates
  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          console.log('Order status update:', payload);
          if (payload.new) {
            const newStatus = (payload.new as any).status;
            const oldStatus = order?.status;
            
            // Show live status notification
            if (newStatus !== oldStatus && oldStatus) {
              showStatusChangeToast(newStatus, order?.order_type || 'delivery', order?.order_number || '');
            }
            
            // Show cashback toast when order is delivered
            if (newStatus === 'delivered' && oldStatus !== 'delivered' && !hasShownCashbackToast.current) {
              const orderTotal = (payload.new as any).total || order?.total || 0;
              showCashbackEarnedToast(orderTotal);
              hasShownCashbackToast.current = true;
            }
            
            setOrder(prev => prev ? { ...prev, ...payload.new } : null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, order?.status, cashbackRate]);

  // Polling fallback for ALL users (realtime can be flaky on native WebView)
  useEffect(() => {
    if (!orderId) return;
    const isTerminal = order && ['delivered', 'cancelled'].includes(order.status);
    if (isTerminal) return; // Stop polling for completed orders

    const interval = setInterval(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: freshOrder } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();
          if (freshOrder) {
            const oldStatus = order?.status;
            if (freshOrder.status !== oldStatus && oldStatus) {
              showStatusChangeToast(freshOrder.status, freshOrder.order_type || 'delivery', freshOrder.order_number || '');
              if (freshOrder.status === 'delivered' && !hasShownCashbackToast.current) {
                showCashbackEarnedToast(freshOrder.total || 0);
                hasShownCashbackToast.current = true;
              }
            }
            setOrder(freshOrder);
          }
        }
        // Guest polling is handled separately below
      } catch (err) {
        console.error('Order poll error:', err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [orderId, order?.status, isGuest, cashbackRate]);

  // Auto-poll for guest orders (no realtime subscription available)
  useEffect(() => {
    if (!isGuest || !orderId) return;

    const interval = setInterval(async () => {
      const guestOrders = getGuestOrders();
      const guestEntry = guestOrders.find(o => o.id === orderId);
      const legacyRaw = localStorage.getItem('guest_active_order');
      let email = guestEntry?.email;
      if (!email && legacyRaw) {
        try {
          const parsed = JSON.parse(legacyRaw);
          if (parsed.id === orderId) email = parsed.email;
        } catch {}
      }
      if (!email) return;

      try {
        const { data } = await supabase.functions.invoke('get-guest-order', {
          body: { order_id: orderId, email },
        });
        if (data?.order) {
          const gOrder = data.order;
          const oldStatus = order?.status;
          if (gOrder.status !== oldStatus && oldStatus) {
            showStatusChangeToast(gOrder.status, gOrder.order_type || 'delivery', gOrder.order_number || '');
          }
          setOrder(gOrder);
          if (gOrder.order_items) {
            setOrderItems(gOrder.order_items.map((oi: any) => ({
              id: oi.id, quantity: oi.quantity, unit_price: oi.unit_price, total_price: oi.total_price,
              menu_item: oi.menu_items || null,
            })));
          }
          if (gOrder.branches) setBranch(gOrder.branches);
          if (gOrder.user_addresses) setAddress(gOrder.user_addresses);
          
          // Extract latest driver location from the response
          if (gOrder.driver_locations && Array.isArray(gOrder.driver_locations) && gOrder.driver_locations.length > 0) {
            // Sort by updated_at descending to get the latest
            const sorted = [...gOrder.driver_locations].sort((a: any, b: any) => 
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            );
            const latest = sorted[0];
            setGuestDriverLocation({
              latitude: parseFloat(latest.latitude),
              longitude: parseFloat(latest.longitude),
              heading: latest.heading ? parseFloat(latest.heading) : undefined,
              speed: latest.speed ? parseFloat(latest.speed) : undefined,
              updated_at: latest.updated_at,
            });
          }
          
          // Show cashback toast for delivered
          if (gOrder.status === 'delivered' && oldStatus !== 'delivered' && !hasShownCashbackToast.current) {
            showCashbackEarnedToast(gOrder.total || 0);
            hasShownCashbackToast.current = true;
          }
        }
      } catch (err) {
        console.error('Guest order poll error:', err);
      }
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [isGuest, orderId, order?.status, cashbackRate]);

  const loadCashbackRate = async () => {
    const { data } = await supabase
      .from('tenant_settings')
      .select('cashback_rate, allow_customer_cancel')
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setCashbackRate((data as any).cashback_rate || 0);
      setAllowCustomerCancel((data as any).allow_customer_cancel ?? false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order || order.status !== 'pending') {
      toast.error('Too late — order already confirmed.');
      return;
    }
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled', cancellation_reason: 'Cancelled by customer' } as any)
        .eq('id', order.id);
      if (error) throw error;

      // Trigger Stripe refund (fire-and-forget, don't block UX)
      supabase.functions.invoke('refund-order', { body: { order_id: order.id } })
        .then(({ error: refundErr }) => {
          if (refundErr) console.error('Refund error:', refundErr);
          else console.log('Refund initiated for order:', order.id);
        });

      setOrder(prev => prev ? { ...prev, status: 'cancelled', cancellation_reason: 'Cancelled by customer' } : null);
      toast.success('Order cancelled — refund is being processed');
    } catch (err: any) {
      // Check if order was confirmed in the meantime
      const { data: freshOrder } = await supabase
        .from('orders')
        .select('status')
        .eq('id', order.id)
        .single();
      if (freshOrder && freshOrder.status !== 'pending') {
        toast.error('Too late — order already confirmed.');
        setOrder(prev => prev ? { ...prev, status: freshOrder.status } : null);
      } else {
        toast.error('Failed to cancel order');
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const showStatusChangeToast = (newStatus: string, orderType: string, orderNumber: string) => {
    const messages: Record<string, { title: string; icon: React.ReactNode }> = {
      confirmed: { title: '✅ Order confirmed!', icon: <CheckCircle2 className="h-5 w-5 text-blue-500" /> },
      preparing: { title: '👨‍🍳 Your food is being prepared', icon: <ChefHat className="h-5 w-5 text-orange-500" /> },
      ready: {
        title: orderType === 'pickup' ? '🎉 Ready for pickup!' : '✅ Food is ready',
        icon: <Package className="h-5 w-5 text-green-500" />,
      },
      out_for_delivery: { title: '🚗 Your order is on its way!', icon: <Navigation className="h-5 w-5 text-primary" /> },
      delivered: { title: '🎉 Order delivered!', icon: <Package className="h-5 w-5 text-green-500" /> },
      cancelled: { title: '❌ Order cancelled', icon: <XCircle className="h-5 w-5 text-destructive" /> },
    };
    const msg = messages[newStatus];
    if (msg) {
      toast(msg.title, {
        icon: msg.icon,
        description: `Order #${orderNumber}`,
        duration: 4000,
      });
    }
  };

  const showCashbackEarnedToast = (orderTotal: number) => {
    if (cashbackRate > 0 && orderTotal > 0) {
      const cashbackEarned = (orderTotal * cashbackRate) / 100;
      const currency = branding?.currency || 'USD';
      
      toast.success(
        `You earned ${formatCurrency(cashbackEarned, currency)} cashback!`,
        {
          description: 'Cashback has been added to your balance',
          icon: <Coins className="h-5 w-5 text-amber-500" />,
          duration: 5000,
        }
      );
    }
  };

  const extractGuestDriverLocation = (gOrder: any) => {
    if (gOrder.driver_locations && Array.isArray(gOrder.driver_locations) && gOrder.driver_locations.length > 0) {
      const sorted = [...gOrder.driver_locations].sort((a: any, b: any) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      const latest = sorted[0];
      setGuestDriverLocation({
        latitude: parseFloat(latest.latitude),
        longitude: parseFloat(latest.longitude),
        heading: latest.heading ? parseFloat(latest.heading) : undefined,
        speed: latest.speed ? parseFloat(latest.speed) : undefined,
        updated_at: latest.updated_at,
      });
    }
  };

  const loadOrderDetails = async () => {
    try {
      if (!orderId) {
        setLoading(false);
        return;
      }

      if (user) {
        setIsGuest(false);
        // Authenticated flow — direct DB query
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (orderError) throw orderError;
        setOrder(orderData);

        // Load order items
        const { data: itemsData } = await supabase
          .from('order_items')
          .select(`id, quantity, unit_price, total_price, menu_item:menu_items (name, image_url)`)
          .eq('order_id', orderId);
        if (itemsData) setOrderItems(itemsData as any);

        // Load delivery address
        if (orderData.delivery_address_id) {
          const { data: addressData } = await supabase
            .from('user_addresses')
            .select('*')
            .eq('id', orderData.delivery_address_id)
            .single();
          if (addressData) setAddress(addressData);
        }

        // Load branch
        if (orderData.branch_id) {
          const { data: branchData } = await supabase
            .from('branches')
            .select('*')
            .eq('id', orderData.branch_id)
            .single();
          if (branchData) setBranch(branchData);
        }
      } else {
        setIsGuest(true);
        // Guest flow — use edge function
        const guestOrders = getGuestOrders();
        const guestEntry = guestOrders.find(o => o.id === orderId);
        if (!guestEntry) {
          // Also check legacy single active order entry
          const legacyRaw = localStorage.getItem('guest_active_order');
          let legacyEmail: string | null = null;
          if (legacyRaw) {
            try {
              const parsed = JSON.parse(legacyRaw);
              if (parsed.id === orderId) legacyEmail = parsed.email;
            } catch {}
          }
          if (!legacyEmail) {
            setLoading(false);
            return;
          }
          // Use legacy email
          const { data, error } = await supabase.functions.invoke('get-guest-order', {
            body: { order_id: orderId, email: legacyEmail },
          });
          if (error || !data?.order) { setLoading(false); return; }
          const gOrder = data.order;
          setOrder(gOrder);
          if (gOrder.order_items) {
            setOrderItems(gOrder.order_items.map((oi: any) => ({
              id: oi.id, quantity: oi.quantity, unit_price: oi.unit_price, total_price: oi.total_price,
              menu_item: oi.menu_items || null,
            })));
          }
          if (gOrder.branches) setBranch(gOrder.branches);
          if (gOrder.user_addresses) setAddress(gOrder.user_addresses);
          extractGuestDriverLocation(gOrder);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke('get-guest-order', {
          body: { order_id: orderId, email: guestEntry.email },
        });
        if (error || !data?.order) { setLoading(false); return; }
        const gOrder = data.order;
        setOrder(gOrder);
        if (gOrder.order_items) {
          setOrderItems(gOrder.order_items.map((oi: any) => ({
            id: oi.id, quantity: oi.quantity, unit_price: oi.unit_price, total_price: oi.total_price,
            menu_item: oi.menu_items || null,
          })));
        }
        if (gOrder.branches) setBranch(gOrder.branches);
        if (gOrder.user_addresses) setAddress(gOrder.user_addresses);
        extractGuestDriverLocation(gOrder);
      }
    } catch (error) {
      console.error('Error loading order details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusMessage = () => {
    if (!order) return '';
    
    switch (order.status) {
      case 'pending':
        return 'Your order is being reviewed by the restaurant';
      case 'confirmed':
        return 'Great news! The restaurant has accepted your order';
      case 'preparing':
        return 'Your delicious food is being prepared';
      case 'ready':
        return order.order_type === 'pickup' 
          ? 'Your order is ready! Head to the restaurant to pick it up'
          : 'Your order is ready and waiting for the driver';
      case 'out_for_delivery':
        return 'Your order is on its way!';
      case 'delivered':
        return 'Your order has been delivered. Enjoy!';
      case 'cancelled':
        return 'This order has been cancelled';
      default:
        return 'Order status: ' + order.status;
    }
  };

  if (loading) {
    return <LoadingScreen show={true} />;
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="p-8 text-center">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Order Not Found</h2>
          <p className="text-muted-foreground mb-6">
            We couldn't find the order you're looking for.
          </p>
          <Button onClick={() => navigate('/order-history')}>
            View All Orders
          </Button>
        </Card>
      </div>
    );
  }

  // Full-screen cancelled order page
  if (order.status === 'cancelled') {
    const reason = order.cancellation_reason || 'No reason provided';
    const isCustomerCancelled = reason.toLowerCase().includes('customer');
    
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Compact header */}
        <div className="bg-card border-b">
          <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
            <BackButton />
            <span className="text-sm text-muted-foreground">Order #{order.order_number}</span>
          </div>
        </div>

        {/* Centered content */}
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-md w-full text-center space-y-8">
            {/* Animated icon */}
            <div className="relative mx-auto w-28 h-28">
              <div className="absolute inset-0 rounded-full bg-destructive/10 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="relative w-28 h-28 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-14 w-14 text-destructive" />
              </div>
            </div>

            {/* Apology */}
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-foreground">
                Order Cancelled
              </h1>
              <p className="text-muted-foreground text-base leading-relaxed">
                {isCustomerCancelled
                  ? "Your order has been cancelled as requested. We're sorry to see it go!"
                  : "We sincerely apologize — your order could not be fulfilled. We hope to serve you better next time."}
              </p>
            </div>

            {/* Reason card */}
            <Card className="bg-destructive/5 border-destructive/20 text-left">
              <div className="p-5 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Reason
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">{reason}</p>
              </div>
            </Card>

            {/* Order summary mini */}
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Placed on {new Date(order.created_at).toLocaleDateString(undefined, {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              })}</p>
              <p>Total: {formatCurrency(order.total, branding?.currency || 'USD')}</p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-2">
              <Button
                size="lg"
                className="w-full"
                onClick={() => navigate('/')}
              >
                Order Again
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => navigate('/order-history')}
              >
                View All Orders
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currency = branding?.currency || 'USD';

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-20">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BackButton />
              <div>
                <h1 className="text-lg font-bold">Order #{order.order_number}</h1>
                <p className="text-sm text-muted-foreground">
                  {new Date(order.created_at).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Order Progress Tracker */}
        <OrderProgressTracker status={order.status} orderType={order.order_type} />

        {/* Live Countdown Timer */}
        <LiveOrderCountdown
          orderType={order.order_type}
          status={order.status}
          estimatedReadyAt={order.estimated_ready_at}
          branchLat={branch?.latitude}
          branchLng={branch?.longitude}
          deliveryLat={address?.latitude}
          deliveryLng={address?.longitude}
          guestDeliveryLat={order.guest_delivery_lat}
          guestDeliveryLng={order.guest_delivery_lng}
        />

        {/* Map Section - unified for all order types */}
        <OrderTrackingMap
          orderId={order.id}
          orderType={order.order_type}
          status={order.status}
          deliveryAddress={address}
          restaurantLocation={branch ? {
            latitude: branch.latitude,
            longitude: branch.longitude,
            name: branch.name,
            address: branch.address
          } : null}
          guestDeliveryAddress={order.guest_delivery_address}
          guestDeliveryLat={order.guest_delivery_lat ?? (address?.latitude ? Number(address.latitude) : null)}
          guestDeliveryLng={order.guest_delivery_lng ?? (address?.longitude ? Number(address.longitude) : null)}
          isGuest={isGuest}
          guestDriverLocation={guestDriverLocation}
        />

        {/* Location & Actions Card - all order types */}
        {branch && (
          <Card className="p-4">
            <div className="space-y-4">
              {/* Restaurant/Branch Info */}
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Store className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{branch.name}</p>
                  <p className="text-sm text-muted-foreground">{branch.address}</p>
                </div>
              </div>

              {/* Delivery Address - delivery only */}
              {order.order_type === 'delivery' && (address || order.guest_delivery_address) && (
                <div className="flex items-start gap-3 pt-3 border-t">
                  <div className="p-2 bg-accent/20 rounded-lg">
                    <MapPin className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Delivery Address</p>
                    {address ? (
                      <p className="text-sm text-muted-foreground">
                        {address.address_line1}
                        {address.address_line2 && `, ${address.address_line2}`}, {address.city}
                        {address.postal_code && ` ${address.postal_code}`}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">{order.guest_delivery_address}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Google Maps directions button - pickup/dine_in only */}
              {order.order_type !== 'delivery' && branch.latitude && branch.longitude && (
                <button
                  onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${branch.latitude},${branch.longitude}`, '_blank', 'noopener,noreferrer')}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-muted/50 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
                >
                  <img src={googleMapsIcon} alt="Google Maps" className="h-9 w-9 rounded-md object-contain" />
                  Need Directions? Open in Maps
                  <ExternalLink className="h-3.5 w-3.5 ml-0.5 opacity-60" />
                </button>
              )}

              {/* Call Restaurant */}
              <button
                onClick={() => window.open(`tel:${branch.phone}`, '_self')}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-muted/50 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
              >
                <Phone className="h-4 w-4" />
                Call Restaurant
              </button>
            </div>
          </Card>
        )}

        {/* Order Items */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Order Items</h3>
          </div>
          <div className="divide-y">
            {orderItems.map((item) => (
              <div key={item.id} className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  {item.menu_item?.image_url ? (
                    <img 
                      src={item.menu_item.image_url} 
                      alt={item.menu_item?.name || 'Item'} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.menu_item?.name || 'Unknown Item'}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.quantity} × {formatCurrency(item.unit_price, currency)}
                  </p>
                </div>
                <p className="font-medium">
                  {formatCurrency(item.total_price, currency)}
                </p>
              </div>
            ))}
          </div>
          
          {/* Order Summary */}
          <div className="p-4 bg-muted/50 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(order.subtotal, currency)}</span>
            </div>
            {order.tax && order.tax > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatCurrency(order.tax, currency)}</span>
              </div>
            )}
            {order.delivery_fee && order.delivery_fee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery Fee</span>
                <span>{formatCurrency(order.delivery_fee, currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold pt-2 border-t">
              <span>Total</span>
              <span>{formatCurrency(order.total, currency)}</span>
            </div>
          </div>
        </Card>

        {/* Need Help */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Need Help?</p>
              <p className="text-sm text-muted-foreground">Contact support for any issues</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/order-history')}>
              All Orders
            </Button>
          </div>
        </Card>

        {/* Cancel Order Button */}
        {allowCustomerCancel && order.status !== 'cancelled' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="lg"
                className="w-full"
                disabled={order.status !== 'pending' || isCancelling}
              >
                <XCircle className="h-4 w-4 mr-2" />
                {isCancelling
                  ? 'Cancelling...'
                  : order.status !== 'pending'
                    ? 'Cannot cancel after confirmation'
                    : 'Cancel Order'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
                <AlertDialogDescription>
                  You can only cancel before the restaurant confirms. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Order</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancelOrder}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, Cancel
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
