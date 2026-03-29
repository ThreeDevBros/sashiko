import { useEffect, useState } from 'react';
import { formatOrderDisplayNumber } from '@/lib/orderNumber';
import { supabase } from '@/integrations/supabase/client';
import LoadingScreen from '@/components/LoadingScreen';
import { useBranding } from '@/hooks/useBranding';
import sashikoLogo from '@/assets/sashiko-logo.png';
import { DriverLocationTracker } from '@/components/delivery/DriverLocationTracker';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Package, Phone, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Order {
  id: string;
  order_number: string;
  display_number?: number | null;
  status: string;
  created_at: string;
  guest_name?: string;
  guest_phone?: string;
  delivery_address_id: string;
  special_instructions?: string;
}

interface Address {
  address_line1: string;
  address_line2?: string;
  city: string;
  postal_code?: string;
}

export default function DriverDashboard() {
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [loading, setLoading] = useState(true);
  const { branding } = useBranding();
  const { toast } = useToast();

  useEffect(() => {
    loadActiveOrder();
  }, []);

  const loadActiveOrder = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Get active order assigned to this driver
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('driver_id', user.id)
        .eq('status', 'out_for_delivery')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (orderError && orderError.code !== 'PGRST116') throw orderError;
      
      if (orderData) {
        setActiveOrder(orderData);

        // Load delivery address
        const { data: addressData, error: addressError } = await supabase
          .from('user_addresses')
          .select('*')
          .eq('id', orderData.delivery_address_id)
          .single();

        if (addressError) throw addressError;
        setAddress(addressData);
      }
    } catch (error) {
      console.error('Error loading active order:', error);
      toast({
        title: 'Error',
        description: 'Failed to load active delivery',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsDelivered = async () => {
    if (!activeOrder) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'delivered' })
        .eq('id', activeOrder.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Order marked as delivered',
      });

      setActiveOrder(null);
      setAddress(null);
    } catch (error) {
      console.error('Error marking order as delivered:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark order as delivered',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!activeOrder) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="p-8 text-center">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">No Active Deliveries</h2>
          <p className="text-muted-foreground">
            You don't have any active deliveries at the moment.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Active Delivery</h1>

      <div className="space-y-6">
        {/* Order Details */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Order #{formatOrderDisplayNumber(activeOrder.display_number)}</h2>
            <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              Out for Delivery
            </Badge>
          </div>

          <div className="space-y-4">
            {/* Customer Info */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Customer</h3>
                <p className="text-sm text-muted-foreground">
                  {activeOrder.guest_name || 'N/A'}
                </p>
              </div>
            </div>

            {/* Phone */}
            {activeOrder.guest_phone && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Phone</h3>
                  <a 
                    href={`tel:${activeOrder.guest_phone}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {activeOrder.guest_phone}
                  </a>
                </div>
              </div>
            )}

            {/* Delivery Address */}
            {address && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Delivery Address</h3>
                  <p className="text-sm text-muted-foreground">
                    {address.address_line1}
                    {address.address_line2 && <>, {address.address_line2}</>}
                    <br />
                    {address.city}
                    {address.postal_code && `, ${address.postal_code}`}
                  </p>
                </div>
              </div>
            )}

            {/* Special Instructions */}
            {activeOrder.special_instructions && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Special Instructions</h3>
                  <p className="text-sm text-muted-foreground">
                    {activeOrder.special_instructions}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Location Tracker */}
        <DriverLocationTracker orderId={activeOrder.id} />

        {/* Mark as Delivered */}
        <Button 
          onClick={markAsDelivered}
          className="w-full"
          size="lg"
        >
          Mark as Delivered
        </Button>
      </div>
    </div>
  );
}
