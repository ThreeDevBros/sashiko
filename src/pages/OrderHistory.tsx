import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Package, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { BackButton } from "@/components/BackButton";
import LoadingScreen from "@/components/LoadingScreen";
import { useBranding } from "@/hooks/useBranding";
import { formatCurrency } from "@/lib/currency";
import { getGuestOrders } from "@/lib/guestOrders";
import { OrderDetailSheet } from "@/components/order/OrderDetailSheet";

interface Order {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  order_type: string;
}

const OrderHistory = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { branding } = useBranding();
  const { user, isAuthReady } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const completedStatuses = ['delivered', 'cancelled'];

  useEffect(() => {
    if (!isAuthReady) return;
    fetchOrders();
  }, [isAuthReady]);

  const fetchOrders = async () => {
    try {
      if (user) {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq('user_id', user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setOrders(data || []);
      } else {
        const guestEntries = getGuestOrders();
        const fetched: Order[] = [];

        await Promise.all(
          guestEntries.map(async (entry) => {
            try {
              const { data, error } = await supabase.functions.invoke('get-guest-order', {
                body: { order_id: entry.id, email: entry.email },
              });
              if (!error && data?.order) {
                const o = data.order;
                fetched.push({
                  id: o.id,
                  order_number: o.order_number,
                  status: o.status,
                  total: o.total,
                  created_at: o.created_at,
                  order_type: o.order_type,
                });
              }
            } catch {}
          })
        );

        fetched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setOrders(fetched);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const handleOrderClick = (order: Order) => {
    if (!completedStatuses.includes(order.status)) {
      // Active orders go to tracking
      navigate(`/order-tracking/${order.id}`);
    } else {
      // Completed orders open the detail sheet
      setSelectedOrderId(order.id);
      setSheetOpen(true);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: "bg-yellow-500",
      confirmed: "bg-blue-500",
      preparing: "bg-purple-500",
      ready: "bg-green-500",
      out_for_delivery: "bg-orange-500",
      delivered: "bg-green-600",
      cancelled: "bg-red-500",
    };
    return colors[status] || "bg-muted";
  };

  const formatStatus = (status: string) => {
    return status.split("_").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
  };

  if (loading) {
    return <LoadingScreen show={true} />;
  }

  const currency = branding?.currency || 'USD';

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <BackButton />
        </div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('orders.title')}</h1>
          <p className="text-muted-foreground">{t('orders.subtitle')}</p>
        </div>

        {orders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
               <p className="text-lg font-medium mb-1">{t('orders.noOrders')}</p>
              <p className="text-sm text-muted-foreground mb-4">
                {t('orders.noOrdersDesc')}
              </p>
              <Button onClick={() => navigate('/order')}>
                {t('cart.browseMenu')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const isActive = !completedStatuses.includes(order.status);
              
              return (
                <Card 
                  key={order.id} 
                  className="transition-all hover:shadow-lg cursor-pointer active:scale-[0.98]"
                  onClick={() => handleOrderClick(order)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">Order #{order.order_number}</p>
                          {isActive && (
                          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                              {t('orders.active')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {new Date(order.created_at).toLocaleDateString()} at{" "}
                          {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {order.status !== 'delivered' && (
                        <Badge className={`${getStatusColor(order.status)} text-white`}>
                          {formatStatus(order.status)}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="capitalize">{order.order_type.replace("_", " ")}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-primary">
                          {formatCurrency(order.total, currency)}
                        </span>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <OrderDetailSheet
        orderId={selectedOrderId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
};

export default OrderHistory;
