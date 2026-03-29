import { useEffect, useState } from 'react';
import { formatOrderDisplayNumber } from '@/lib/orderNumber';
import { supabase } from '@/integrations/supabase/client';
import { DriverLayout } from '@/components/driver/DriverLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Package, Phone, Clock, Navigation, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ActiveOrder {
  id: string;
  order_number: string;
  display_number: number | null;
  status: string;
  guest_name: string | null;
  guest_phone: string | null;
  guest_delivery_address: string | null;
  special_instructions: string | null;
  total: number;
  delivery_address_id: string | null;
}

export default function DriverActiveDelivery() {
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [lastDriverLocation, setLastDriverLocation] = useState<Date | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadActiveOrders();

    const channel = supabase
      .channel('driver-active-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadActiveOrders();
      })
      .subscribe();

    // Poll driver_locations to show last update time from global tracker
    const locationPoll = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('driver_locations')
        .select('updated_at')
        .eq('driver_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setLastDriverLocation(new Date(data[0].updated_at));
      }
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(locationPoll);
    };
  }, []);

  const loadActiveOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('driver_id', user.id)
        .eq('status', 'out_for_delivery')
        .order('created_at', { ascending: true });

      setActiveOrders(data || []);
    } catch (error) {
      console.error('Error loading active orders:', error);
    } finally {
      setLoading(false);
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
      loadActiveOrders();
    } catch (error) {
      console.error('Error:', error);
      toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
  };

  const isTracking = activeOrders.length > 0;

  return (
    <DriverLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Active Deliveries</h1>

        {/* GPS Tracking Status - powered by GlobalDriverTracker */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isTracking ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'}`}>
                <Navigation className={`h-5 w-5 ${isTracking ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">GPS Tracking</h3>
                <p className="text-xs text-muted-foreground">
                  {isTracking ? 'Auto-tracking every 10s (works on all pages)' : 'Inactive — no active deliveries'}
                  {lastDriverLocation && ` • Last: ${lastDriverLocation.toLocaleTimeString()}`}
                </p>
              </div>
            </div>
            <Badge variant={isTracking ? 'default' : 'secondary'}>
              {isTracking ? 'Live' : 'Off'}
            </Badge>
          </div>
        </Card>

        {/* Active Orders */}
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        ) : activeOrders.length === 0 ? (
          <Card className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h2 className="text-xl font-bold mb-1">No Active Deliveries</h2>
            <p className="text-muted-foreground text-sm">
              Pick up orders from the Available Orders tab
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {activeOrders.map(order => (
              <Card key={order.id} className="p-4 space-y-3 border-primary/20">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">#{formatOrderDisplayNumber(order.display_number)}</h3>
                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                    Out for Delivery
                  </Badge>
                </div>

                <div className="space-y-2 text-sm">
                  {order.guest_name && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Package className="h-4 w-4 flex-shrink-0" />
                      <span>{order.guest_name}</span>
                    </div>
                  )}

                  {order.guest_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <a href={`tel:${order.guest_phone}`} className="text-primary hover:underline">
                        {order.guest_phone}
                      </a>
                    </div>
                  )}

                  {order.guest_delivery_address && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>{order.guest_delivery_address}</span>
                    </div>
                  )}

                  {order.special_instructions && (
                    <div className="p-2 bg-muted rounded-lg text-xs">
                      <span className="font-medium">Note:</span> {order.special_instructions}
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => markDelivered(order.id)}
                  disabled={updatingId === order.id}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  <Package className="h-4 w-4 mr-2" />
                  {updatingId === order.id ? 'Updating...' : 'Mark as Delivered'}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DriverLayout>
  );
}
