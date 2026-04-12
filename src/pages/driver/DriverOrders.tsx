import { useEffect, useState } from 'react';
import { formatOrderDisplayNumber } from '@/lib/orderNumber';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAppLifecycle } from '@/hooks/useAppLifecycle';
import { DriverLayout } from '@/components/driver/DriverLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, MapPin, Clock, Truck, Navigation, ChefHat } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface OrderWithAddress {
  id: string;
  order_number: string;
  display_number: number | null;
  status: string;
  created_at: string;
  guest_name: string | null;
  estimated_ready_at: string | null;
  guest_phone: string | null;
  guest_delivery_address: string | null;
  guest_delivery_lat: number | null;
  guest_delivery_lng: number | null;
  total: number;
  order_type: string;
  special_instructions: string | null;
  delivery_address_id: string | null;
  user_id: string | null;
  driver_id: string | null;
  estimated_delivery_time: string | null;
}

export default function DriverOrders() {
  const { user, isAuthReady, refreshSession } = useAuth();
  const [preparingOrders, setPreparingOrders] = useState<OrderWithAddress[]>([]);
  const [orders, setOrders] = useState<OrderWithAddress[]>([]);
  const [activeOrders, setActiveOrders] = useState<OrderWithAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { toast } = useToast();
  const [resumeCounter, setResumeCounter] = useState(0);

  // Reconnect on app resume
  useAppLifecycle(async () => {
    await refreshSession();
    loadOrders();
    setResumeCounter(c => c + 1);
  });

  useEffect(() => {
    if (!isAuthReady || !user) return;
    loadOrders();

    const channel = supabase
      .channel(`driver-orders-${resumeCounter}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAuthReady, user, resumeCounter]);

  const loadOrders = async () => {
    if (!user) return;
    try {

      // Get driver's branch
      const { data: staffBranch } = await supabase
        .from('staff_branches')
        .select('branch_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!staffBranch) {
        setLoading(false);
        return;
      }

      // Get preparing orders (not ready yet, driver can see them coming)
      const { data: prepOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('branch_id', staffBranch.branch_id)
        .in('status', ['confirmed', 'preparing'])
        .eq('order_type', 'delivery')
        .order('created_at', { ascending: true });

      setPreparingOrders(prepOrders || []);

      // Get ready orders for this branch (available for pickup)
      const { data: readyOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('branch_id', staffBranch.branch_id)
        .eq('status', 'ready')
        .eq('order_type', 'delivery')
        .order('created_at', { ascending: true });

      setOrders(readyOrders || []);

      // Get ALL out_for_delivery orders for this branch (assigned to this driver OR unassigned)
      const { data: outOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('branch_id', staffBranch.branch_id)
        .eq('status', 'out_for_delivery')
        .eq('order_type', 'delivery')
        .order('created_at', { ascending: false });

      setActiveOrders(outOrders || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const markOutForDelivery = async (orderId: string) => {
    setUpdatingId(orderId);
    try {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('orders')
        .update({ status: 'out_for_delivery', driver_id: user.id })
        .eq('id', orderId);

      if (error) throw error;

      toast({ title: 'Order picked up', description: 'Order is now out for delivery' });
      loadOrders();
    } catch (error) {
      console.error('Error updating order:', error);
      toast({ title: 'Error', description: 'Failed to update order', variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
  };

  const markDelivered = async (orderId: string) => {
    setUpdatingId(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'delivered' })
        .eq('id', orderId);

      if (error) throw error;

      toast({ title: 'Delivered!', description: 'Order marked as delivered' });
      loadOrders();
    } catch (error) {
      console.error('Error updating order:', error);
      toast({ title: 'Error', description: 'Failed to mark as delivered', variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Confirmed</Badge>;
      case 'preparing':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Preparing</Badge>;
      case 'ready':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Ready for Pickup</Badge>;
      case 'out_for_delivery':
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Out for Delivery</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getEstimatedReadyLabel = (order: OrderWithAddress) => {
    if (!order.estimated_ready_at) return null;
    const readyAt = new Date(order.estimated_ready_at);
    const now = new Date();
    const diffMs = readyAt.getTime() - now.getTime();
    const diffMins = Math.max(0, Math.ceil(diffMs / 60000));
    
    if (diffMins <= 0) return 'Should be ready now';
    return `Ready in ~${diffMins} min (${readyAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
  };

  const OrderCard = ({ order, showPickup, isPreparing }: { order: OrderWithAddress; showPickup: boolean; isPreparing?: boolean }) => (
    <Card className={`p-4 space-y-3 ${isPreparing ? 'opacity-90 border-dashed' : ''}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">#{formatOrderDisplayNumber(order.display_number)}</h3>
        {getStatusBadge(order.status)}
      </div>

      {/* Estimated ready time for preparing orders */}
      {isPreparing && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-sm font-medium text-amber-700 dark:text-amber-300">
          <ChefHat className="h-4 w-4 flex-shrink-0" />
          <span>{getEstimatedReadyLabel(order) || 'Prep time not set yet'}</span>
        </div>
      )}

      <div className="space-y-2 text-sm">
        {order.guest_name && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Package className="h-4 w-4 flex-shrink-0" />
            <span>{order.guest_name}</span>
            {order.guest_phone && (
              <a href={`tel:${order.guest_phone}`} className="text-primary hover:underline ml-auto">
                {order.guest_phone}
              </a>
            )}
          </div>
        )}

        {order.guest_delivery_address && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{order.guest_delivery_address}</span>
          </div>
        )}

        {order.estimated_delivery_time && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span>Scheduled: {new Date(order.estimated_delivery_time).toLocaleString()}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4 flex-shrink-0" />
          <span>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}</span>
        </div>

        {order.special_instructions && (
          <div className="p-2 bg-muted rounded-lg text-xs">
            <span className="font-medium">Note:</span> {order.special_instructions}
          </div>
        )}
      </div>

      {!isPreparing && (
        <div className="flex gap-2 pt-1">
          {(order.guest_delivery_lat && order.guest_delivery_lng) || order.guest_delivery_address ? (
            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0"
              onClick={() => {
                const url = order.guest_delivery_lat && order.guest_delivery_lng
                  ? `https://www.google.com/maps/search/?api=1&query=${order.guest_delivery_lat},${order.guest_delivery_lng}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.guest_delivery_address!)}`;
                window.open(url, '_blank');
              }}
            >
              <Navigation className="h-4 w-4 mr-1" />
              Directions
            </Button>
          ) : null}

          {showPickup ? (
            <Button
              onClick={() => markOutForDelivery(order.id)}
              disabled={updatingId === order.id}
              className="flex-1"
            >
              <Truck className="h-4 w-4 mr-2" />
              {updatingId === order.id ? 'Updating...' : 'Out for Delivery'}
            </Button>
          ) : (
            <Button
              onClick={() => markDelivered(order.id)}
              disabled={updatingId === order.id}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Package className="h-4 w-4 mr-2" />
              {updatingId === order.id ? 'Updating...' : 'Mark Delivered'}
            </Button>
          )}
        </div>
      )}
    </Card>
  );

  return (
    <DriverLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Driver Dashboard</h1>

        {/* Active deliveries */}
        {activeOrders.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Active Deliveries ({activeOrders.length})
            </h2>
            {activeOrders.map(order => (
              <OrderCard key={order.id} order={order} showPickup={false} />
            ))}
          </div>
        )}

        {/* Ready for pickup */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Ready for Pickup ({orders.length})
          </h2>
          {loading ? (
            <div className="text-center text-muted-foreground py-8">Loading orders...</div>
          ) : orders.length === 0 ? (
            <Card className="p-8 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No orders ready for pickup</p>
            </Card>
          ) : (
            orders.map(order => (
              <OrderCard key={order.id} order={order} showPickup={true} />
            ))
          )}
        </div>

        {/* Being prepared */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            Being Prepared ({preparingOrders.length})
          </h2>
          {!loading && preparingOrders.length === 0 ? (
            <Card className="p-8 text-center">
              <ChefHat className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No orders being prepared</p>
            </Card>
          ) : (
            preparingOrders.map(order => (
              <OrderCard key={order.id} order={order} showPickup={false} isPreparing={true} />
            ))
          )}
        </div>
      </div>
    </DriverLayout>
  );
}
