import { useState, useEffect } from 'react';
import { formatOrderDisplayNumber } from '@/lib/orderNumber';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, subMonths } from 'date-fns';
import { Check, X, Clock, Package, Calendar, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useOrderAlerts } from '@/hooks/useOrderAlerts';

const ACTIVE_ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'] as const;
const COMPLETED_ORDER_STATUSES = ['delivered', 'cancelled'] as const;

export default function StaffDashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('orders');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    navigate('/auth');
  };

  // Real-time subscription for orders
  useEffect(() => {
    const channel = supabase
      .channel('staff-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['staff-pending-orders'] });
          queryClient.invalidateQueries({ queryKey: ['staff-order-history'] });
          
          if (payload.eventType === 'INSERT' && payload.new?.status === 'pending') {
            toast.success('New order received!', {
              description: `Order #${formatOrderDisplayNumber(payload.new.display_number)}`,
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);
  
  // Fetch active orders
  const { data: pendingOrders, isLoading: loadingOrders } = useQuery({
    queryKey: ['staff-pending-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          profiles:user_id(full_name),
          branches:branch_id(name)
        `)
        .in('status', ACTIVE_ORDER_STATUSES)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const pendingOrderIds = pendingOrders?.filter(o => o.status === 'pending').map(o => o.id) || [];
  useOrderAlerts(pendingOrderIds);

  // Fetch order history (last month)
  const { data: orderHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ['staff-order-history'],
    queryFn: async () => {
      const oneMonthAgo = subMonths(new Date(), 1).toISOString();
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          profiles:user_id(full_name),
          branches:branch_id(name)
        `)
        .gte('created_at', oneMonthAgo)
        .in('status', COMPLETED_ORDER_STATUSES)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch pending reservations
  const { data: pendingReservations, isLoading: loadingReservations } = useQuery({
    queryKey: ['staff-pending-reservations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('table_reservations')
        .select(`
          *,
          branches:branch_id(name)
        `)
        .eq('status', 'pending')
        .order('reservation_date', { ascending: true })
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  // Update order status
  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: 'confirmed' | 'cancelled' }) => {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-pending-orders'] });
      queryClient.invalidateQueries({ queryKey: ['staff-order-history'] });
      toast.success('Order updated successfully');
    },
    onError: () => { toast.error('Failed to update order'); },
  });

  // Update reservation status
  const updateReservationMutation = useMutation({
    mutationFn: async ({ reservationId, status }: { reservationId: string; status: 'confirmed' | 'cancelled' }) => {
      const { error } = await supabase
        .from('table_reservations')
        .update({ status })
        .eq('id', reservationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-pending-reservations'] });
      toast.success('Reservation updated successfully');
    },
    onError: () => { toast.error('Failed to update reservation'); },
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500',
      confirmed: 'bg-blue-500',
      preparing: 'bg-purple-500',
      ready: 'bg-green-500',
      out_for_delivery: 'bg-indigo-500',
      delivered: 'bg-green-600',
      cancelled: 'bg-red-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-16 border-b bg-card flex items-center justify-between px-6 sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-primary">Staff Dashboard</h1>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </header>

      {/* Main Content */}
      <div className="p-6 max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="reservations" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Pending Reservations
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Order History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Active Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingOrders ? (
                  <p>Loading orders...</p>
                ) : pendingOrders && pendingOrders.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">#{formatOrderDisplayNumber(order.display_number)}</TableCell>
<TableCell>{order.user_id ? (order.profiles?.full_name || order.guest_name || 'Registered customer') : (order.guest_name || 'Guest')}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{order.order_type}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(order.status!)}>{order.status}</Badge>
                          </TableCell>
                          <TableCell>{order.branches?.name || 'N/A'}</TableCell>
                          <TableCell>${order.total.toFixed(2)}</TableCell>
                          <TableCell>{format(new Date(order.created_at!), 'HH:mm')}</TableCell>
                          <TableCell className="text-right">
                            {order.status === 'pending' ? (
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  onClick={() => updateOrderMutation.mutate({ orderId: order.id, status: 'confirmed' })}
                                  disabled={updateOrderMutation.isPending}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => updateOrderMutation.mutate({ orderId: order.id, status: 'cancelled' })}
                                  disabled={updateOrderMutation.isPending}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Deny
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No active orders</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reservations">
            <Card>
              <CardHeader>
                <CardTitle>Pending Reservations</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingReservations ? (
                  <p>Loading reservations...</p>
                ) : pendingReservations && pendingReservations.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Guest Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Party Size</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingReservations.map((reservation) => (
                        <TableRow key={reservation.id}>
                          <TableCell className="font-medium">{reservation.guest_name}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{reservation.guest_phone}</div>
                              <div className="text-muted-foreground">{reservation.guest_email}</div>
                            </div>
                          </TableCell>
                          <TableCell>{format(new Date(reservation.reservation_date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell>{reservation.start_time}</TableCell>
                          <TableCell>{reservation.party_size} guests</TableCell>
                          <TableCell>{reservation.branches?.name || 'N/A'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                onClick={() => updateReservationMutation.mutate({ reservationId: reservation.id, status: 'confirmed' })}
                                disabled={updateReservationMutation.isPending}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => updateReservationMutation.mutate({ reservationId: reservation.id, status: 'cancelled' })}
                                disabled={updateReservationMutation.isPending}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Deny
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No pending reservations</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Order History (Last Month)</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <p>Loading history...</p>
                ) : orderHistory && orderHistory.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderHistory.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">#{formatOrderDisplayNumber(order.display_number)}</TableCell>
                          <TableCell>{order.user_id ? (order.profiles?.full_name || order.guest_name || 'Registered customer') : (order.guest_name || 'Guest')}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{order.order_type}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(order.status!)}>
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell>${order.total.toFixed(2)}</TableCell>
                          <TableCell>{format(new Date(order.created_at!), 'MMM dd, HH:mm')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No order history</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
