import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/currency';
import { useBranding } from '@/hooks/useBranding';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Clock, MapPin, Store, Truck, ShoppingBag, Star, RotateCcw,
  CreditCard, Banknote, Mail, Phone, Info, ChevronRight, Loader2, UtensilsCrossed
} from 'lucide-react';

interface OrderItem {
  id: string;
  menu_item_id: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  special_instructions: string | null;
  menu_item: { name: string; image_url: string | null; price: number } | null;
}

interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  order_type: string;
  created_at: string;
  subtotal: number;
  tax: number | null;
  tip: number | null;
  delivery_fee: number | null;
  total: number;
  cashback_used: number | null;
  special_instructions: string | null;
  cancellation_reason: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  guest_delivery_address: string | null;
  branch: { name: string; address: string; phone: string } | null;
  delivery_address: { address_line1: string; city: string } | null;
  items: OrderItem[];
}

interface OrderDetailSheetProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ORDER_TYPE_ICONS: Record<string, React.ElementType> = {
  delivery: Truck,
  pickup: ShoppingBag,
  dine_in: UtensilsCrossed,
};

export function OrderDetailSheet({ orderId, open, onOpenChange }: OrderDetailSheetProps) {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const { addItem, clearCart } = useCart();
  const currency = branding?.currency || 'USD';
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingReceipt, setSendingReceipt] = useState(false);

  const fetchOrderDetail = async (id: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Fetch order
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (orderError) throw orderError;
        if (!orderData) {
          toast.error('Order not found');
          return;
        }

        // Fetch branch
        let branch = null;
        if (orderData.branch_id) {
          const { data: branchData } = await supabase
            .from('branches')
            .select('name, address, phone')
            .eq('id', orderData.branch_id)
            .maybeSingle();
          branch = branchData;
        }

        // Fetch delivery address
        let deliveryAddr = null;
        if (orderData.delivery_address_id) {
          const { data: addrData } = await supabase
            .from('user_addresses')
            .select('address_line1, city')
            .eq('id', orderData.delivery_address_id)
            .maybeSingle();
          deliveryAddr = addrData;
        }

        // Fetch order items with menu item names
        const { data: itemsData } = await supabase
          .from('order_items')
          .select('id, quantity, unit_price, total_price, special_instructions, menu_item_id')
          .eq('order_id', id);

        const items: OrderItem[] = [];
        if (itemsData) {
          for (const item of itemsData) {
            let menuItem = null;
            if (item.menu_item_id) {
              const { data: mi } = await supabase
                .from('menu_items')
                .select('name, image_url, price')
                .eq('id', item.menu_item_id)
                .maybeSingle();
              menuItem = mi;
            }
            items.push({
              id: item.id,
              menu_item_id: item.menu_item_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_price,
              special_instructions: item.special_instructions,
              menu_item: menuItem,
            });
          }
        }

        setOrder({
          id: orderData.id,
          order_number: orderData.order_number,
          status: orderData.status || 'pending',
          order_type: orderData.order_type,
          created_at: orderData.created_at || '',
          subtotal: orderData.subtotal,
          tax: orderData.tax,
          tip: orderData.tip,
          delivery_fee: orderData.delivery_fee,
          total: orderData.total,
          cashback_used: orderData.cashback_used,
          special_instructions: orderData.special_instructions,
          cancellation_reason: orderData.cancellation_reason,
          guest_name: orderData.guest_name,
          guest_email: orderData.guest_email,
          guest_phone: orderData.guest_phone,
          guest_delivery_address: orderData.guest_delivery_address,
          branch,
          delivery_address: deliveryAddr,
          items,
        });
      } else {
        // Guest: use edge function
        const guestOrders = JSON.parse(localStorage.getItem('guest_orders') || '[]');
        const entry = guestOrders.find((e: any) => e.id === id);
        if (!entry) return;

        const { data, error } = await supabase.functions.invoke('get-guest-order', {
          body: { order_id: id, email: entry.email },
        });
        if (error || !data?.order) throw error || new Error('Not found');

        // For guest orders, items may not be included in edge function response
        // We set what we have
        const o = data.order;
        setOrder({
          ...o,
          branch: o.branch || null,
          delivery_address: null,
          items: o.items || [],
        });
      }
    } catch (err) {
      console.error('Error fetching order detail:', err);
      toast.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && orderId) {
      fetchOrderDetail(orderId);
    } else if (!open) {
      setOrder(null);
    }
  }, [open, orderId]);

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
  };

  const handleSendReceipt = async () => {
    if (!order) return;
    setSendingReceipt(true);
    // Simulate receipt sending
    await new Promise(r => setTimeout(r, 1500));
    toast.success('Receipt sent to your email');
    setSendingReceipt(false);
  };

  const handleOrderAgain = () => {
    if (!order?.items?.length) {
      toast.error('No items to reorder');
      return;
    }

    clearCart();

    for (const item of order.items) {
      if (!item.menu_item_id || !item.menu_item) continue;
      for (let i = 0; i < item.quantity; i++) {
        addItem({
          id: item.menu_item_id,
          name: item.menu_item.name,
          price: item.menu_item.price || item.unit_price,
          image_url: item.menu_item.image_url || undefined,
          special_instructions: item.special_instructions || undefined,
        });
      }
    }

    toast.success('Items added to cart');
    onOpenChange(false);
    navigate('/cart');
  };

  const handleRateOrder = () => {
    onOpenChange(false);
    // Could navigate to a review page or open a dialog
    toast.info('Rating feature coming soon');
  };

  const handleContactRestaurant = () => {
    if (order?.branch?.phone) {
      window.open(`tel:${order.branch.phone}`, '_self');
    } else {
      toast.info('Contact info not available');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500',
      confirmed: 'bg-blue-500',
      preparing: 'bg-purple-500',
      ready: 'bg-green-500',
      out_for_delivery: 'bg-orange-500',
      delivered: 'bg-green-600',
      cancelled: 'bg-red-500',
    };
    return colors[status] || 'bg-muted';
  };

  const formatStatus = (status: string) =>
    status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const formatOrderType = (type: string) =>
    type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const OrderTypeIcon = order ? (ORDER_TYPE_ICONS[order.order_type] || ShoppingBag) : ShoppingBag;

  const deliveryAddress = order?.guest_delivery_address || 
    (order?.delivery_address ? `${order.delivery_address.address_line1}, ${order.delivery_address.city}` : null);

  // Determine payment method: if there's no guest info and it's a registered user order,
  // we assume card unless we have more info. For now, simple heuristic.
  const paymentMethod = order?.cashback_used && order.cashback_used > 0 
    ? 'Cashback + Card' 
    : 'Card Payment';

  // Calculate service fee (tax field is used as service fee in this app)
  const serviceFee = order?.tax || 0;
  const discount = order?.cashback_used || 0;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] overflow-y-auto rounded-t-2xl p-0">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : order ? (
          <div className="pb-8">
            {/* Header */}
            <SheetHeader className="sticky top-0 z-10 bg-card border-b border-border px-5 py-4">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-lg">Order #{order.order_number}</SheetTitle>
                {order.status !== 'delivered' && (
                  <Badge className={`${getStatusColor(order.status)} text-white`}>
                    {formatStatus(order.status)}
                  </Badge>
                )}
              </div>
            </SheetHeader>

            <div className="px-5 space-y-5 mt-5">
              {/* Order Overview */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Order Overview</h3>
                <div className="bg-muted/40 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Date & Time</span>
                    </div>
                    <span className="text-sm font-medium">
                      {new Date(order.created_at).toLocaleDateString()} at{' '}
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {order.branch && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Branch</span>
                      </div>
                      <span className="text-sm font-medium">{order.branch.name}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <OrderTypeIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Order Type</span>
                    </div>
                    <span className="text-sm font-medium">{formatOrderType(order.order_type)}</span>
                  </div>

                  {deliveryAddress && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Delivery Address</span>
                      </div>
                      <span className="text-sm font-medium text-right max-w-[55%] truncate">{deliveryAddress}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Info className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Status</span>
                    </div>
                    <span className="text-sm font-medium">{formatStatus(order.status)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {order.status === 'delivered' && (
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={handleRateOrder}
                  >
                    <Star className="h-4 w-4" />
                    Rate Order
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    onClick={handleOrderAgain}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Order Again
                  </Button>
                </div>
              )}

              {order.status === 'cancelled' && (
                <div className="bg-destructive/10 rounded-xl p-4">
                  <p className="text-sm text-destructive font-medium">
                    {order.cancellation_reason || 'This order was cancelled.'}
                  </p>
                </div>
              )}

              <Separator />

              {/* Items Ordered */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Items Ordered</h3>
                <div className="space-y-3">
                  {order.items.length > 0 ? order.items.map((item) => (
                    <div key={item.id} className="flex items-start gap-3">
                      {item.menu_item?.image_url ? (
                        <img
                          src={item.menu_item.image_url}
                          alt={item.menu_item?.name || 'Item'}
                          className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.menu_item?.name || 'Unknown Item'}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                        {item.special_instructions && (
                          <p className="text-xs text-muted-foreground italic mt-0.5">"{item.special_instructions}"</p>
                        )}
                      </div>
                      <span className="text-sm font-medium flex-shrink-0">
                        {formatCurrency(item.total_price, currency)}
                      </span>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">Item details not available</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Price Breakdown */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Price Breakdown</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(order.subtotal, currency)}</span>
                  </div>

                  {order.order_type === 'delivery' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Delivery Fee</span>
                      <span>{order.delivery_fee ? formatCurrency(order.delivery_fee, currency) : 'Free'}</span>
                    </div>
                  )}

                  {serviceFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Service Fee</span>
                      <span>{formatCurrency(serviceFee, currency)}</span>
                    </div>
                  )}

                  {order.tip && order.tip > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tip</span>
                      <span>{formatCurrency(order.tip, currency)}</span>
                    </div>
                  )}

                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Cashback Discount</span>
                      <span>-{formatCurrency(discount, currency)}</span>
                    </div>
                  )}

                  <Separator />

                  <div className="flex justify-between font-semibold text-base">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(order.total, currency)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Payment Details */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Payment Details</h3>
                <div className="flex items-center gap-3 bg-muted/40 rounded-xl p-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{paymentMethod}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(order.total, currency)} charged
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleSendReceipt}
                  disabled={sendingReceipt}
                >
                  {sendingReceipt ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  Send Receipt to Email
                </Button>
              </div>

              <Separator />

              {/* Restaurant Info */}
              {order.branch && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Restaurant Info</h3>
                  <div className="bg-muted/40 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{order.branch.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{order.branch.address}</span>
                    </div>
                    {order.branch.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{order.branch.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Contact Button */}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleContactRestaurant}
              >
                <Phone className="h-4 w-4" />
                Contact {branding?.tenant_name || 'Restaurant'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Order not found</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
