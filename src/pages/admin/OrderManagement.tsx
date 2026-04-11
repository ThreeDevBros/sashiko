import { AdminLayout } from '@/components/admin/AdminLayout';
import { formatOrderDisplayNumber } from '@/lib/orderNumber';
import { MobileOrderCards } from '@/components/admin/MobileOrderCards';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Search, CalendarIcon, X, MessageSquareText, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect, useMemo, Fragment } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useOrderAlerts } from '@/hooks/useOrderAlerts';
import { PauseBranchButton } from '@/components/PauseBranchButton';

// ── Status → color-group mapping ──
type StatusGroup = 'in_progress' | 'completed' | 'failed';

const getStatusGroup = (status: string): StatusGroup => {
  if (['delivered', 'picked_up'].includes(status)) return 'completed';
  if (['cancelled', 'rejected'].includes(status)) return 'failed';
  return 'in_progress';
};

// Row styling per group (subtle bg + left border)
const rowGroupStyles: Record<StatusGroup, string> = {
  in_progress: 'bg-yellow-500/10 border-l-2 border-l-yellow-500',
  completed: 'bg-green-500/10 border-l-2 border-l-green-500',
  failed: 'bg-red-500/10 border-l-2 border-l-red-500',
};

// Badge / pill styling per group
const badgeGroupStyles: Record<StatusGroup, string> = {
  in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
};

// Human-readable status label (respects order type)
const getStatusLabel = (status: string, orderType: string): string => {
  const isPickup = orderType === 'pickup' || orderType === 'dine_in';
  const labels: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    ready: isPickup ? 'Ready for Pickup' : 'Ready',
    ready_for_pickup: 'Ready for Pickup',
    out_for_delivery: 'Out for Delivery',
    delivered: isPickup ? 'Picked Up' : 'Delivered',
    picked_up: 'Picked Up',
    cancelled: 'Rejected',
    rejected: 'Rejected',
  };
  return labels[status] || status;
};

export default function OrderManagement() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [expandedDesktopOrderId, setExpandedDesktopOrderId] = useState<string | null>(null);

  // Real-time subscription for orders
  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['orders-admin'] });
          if (payload.eventType === 'INSERT' && payload.new?.status === 'pending') {
            toast({
              title: '🔔 New Order!',
              description: `Order #${formatOrderDisplayNumber(payload.new.display_number)} received`,
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, toast]);

  const { data: orders } = useQuery({
    queryKey: ['orders-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`*, profiles(full_name), branches(name), order_items(*, menu_items:menu_item_id(name, image_url))`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const pendingOrderIds = useMemo(() => {
    return orders?.filter(o => o.status === 'pending').map(o => o.id) || [];
  }, [orders]);

  useOrderAlerts(pendingOrderIds);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled' }) => {
      const { error } = await supabase.from('orders').update({ status }).eq('id', id);
      if (error) throw error;

      // If cancelling, trigger Stripe refund
      if (status === 'cancelled') {
        supabase.functions.invoke('refund-order', { body: { order_id: id } })
          .then(({ error: refundErr }) => {
            if (refundErr) console.error('Refund error:', refundErr);
          });
      }

      // Send delivery confirmation email
      if (status === 'delivered') {
        supabase.functions.invoke('send-order-email', { body: { order_id: id } })
          .then(({ error: emailErr }) => {
            if (emailErr) console.error('Order email error:', emailErr);
          });
      }

      // Send push notification for status change
      if (['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'].includes(status)) {
        supabase.functions.invoke('send-order-push', { body: { order_id: id, new_status: status } })
          .then(({ error: pushErr }) => {
            if (pushErr) console.error('Push notification error:', pushErr);
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-admin'] });
      toast({ title: 'Order status updated' });
    },
  });

  const filteredOrders = orders?.filter(order => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || (
      order.order_number?.toLowerCase().includes(searchLower) ||
      order.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      order.guest_name?.toLowerCase().includes(searchLower) ||
      order.branches?.name?.toLowerCase().includes(searchLower) ||
      order.status?.toLowerCase().includes(searchLower)
    );
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesType = typeFilter === 'all' || order.order_type === typeFilter;
    const orderDate = new Date(order.created_at);
    const matchesDateFrom = !dateFrom || orderDate >= dateFrom;
    const matchesDateTo = !dateTo || orderDate <= new Date(dateTo.setHours(23, 59, 59, 999));
    return matchesSearch && matchesStatus && matchesType && matchesDateFrom && matchesDateTo;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || dateFrom || dateTo;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Order Management</h1>
            <p className="text-muted-foreground">Monitor and manage all orders</p>
          </div>
          <PauseBranchButton />
        </div>

        <Card>
          <CardContent className="pt-6 px-6 pb-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search orders by number, customer, branch, or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="preparing">Preparing</SelectItem>
                    <SelectItem value="ready">Ready / Ready for Pickup</SelectItem>
                    <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                    <SelectItem value="delivered">Delivered / Picked Up</SelectItem>
                    <SelectItem value="cancelled">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Order Type</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="delivery">Delivery</SelectItem>
                    <SelectItem value="pickup">Pickup</SelectItem>
                    <SelectItem value="dine_in">Dine In</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">From Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">To Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus disabled={(date) => dateFrom ? date < dateFrom : false} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8">
                  <X className="mr-2 h-4 w-4" />
                  Clear Filters
                </Button>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              Showing {filteredOrders?.length || 0} of {orders?.length || 0} orders
            </div>
          </CardContent>

          {/* Desktop Table */}
          <CardContent className="p-0 hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders?.map((order) => {
                  const group = getStatusGroup(order.status);
                  const isPickup = order.order_type === 'pickup' || order.order_type === 'dine_in';
                  const isExpanded = expandedDesktopOrderId === order.id;

                  return (
                    <Fragment key={order.id}>
                      <TableRow
                        className={cn('cursor-pointer', rowGroupStyles[group])}
                        onClick={() =>
                          setExpandedDesktopOrderId((prev) => (prev === order.id ? null : order.id))
                        }
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedDesktopOrderId((prev) => (prev === order.id ? null : order.id));
                              }}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                            <span>#{formatOrderDisplayNumber(order.display_number)}</span>
                          </div>
                        </TableCell>
                        <TableCell>{order.user_id ? (order.profiles?.full_name || order.guest_name || order.guest_email || 'Registered customer') : (order.guest_name || order.guest_email || 'Guest')}</TableCell>
                        <TableCell>{order.branches?.name}</TableCell>
                        <TableCell className="capitalize">{order.order_type?.replace('_', ' ')}</TableCell>
                        <TableCell>{order.order_items?.length || 0}</TableCell>
                        <TableCell>€{Number(order.total).toFixed(2)}</TableCell>
                        <TableCell>
                          {order.special_instructions ? (
                            <div className="flex items-start gap-1 max-w-[200px]">
                              <MessageSquareText className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                              <span className="text-xs text-muted-foreground whitespace-pre-wrap break-words select-all line-clamp-3" title={order.special_instructions}>
                                {order.special_instructions}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('border', badgeGroupStyles[group])}>
                            {getStatusLabel(order.status, order.order_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(order.created_at), 'MMM dd, HH:mm')}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={order.status}
                            disabled={updateStatusMutation.isPending}
                            onValueChange={(value: any) =>
                              updateStatusMutation.mutate({ id: order.id, status: value })
                            }
                          >
                            <SelectTrigger className={cn(
                              'w-36 border',
                              group === 'in_progress' && 'border-yellow-500/40 text-yellow-400',
                              group === 'completed' && 'border-green-500/40 text-green-400',
                              group === 'failed' && 'border-red-500/40 text-red-400',
                            )}>
                              <SelectValue>
                                {getStatusLabel(order.status, order.order_type)}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="confirmed">Confirmed</SelectItem>
                              <SelectItem value="preparing">Preparing</SelectItem>
                              <SelectItem value="ready">{isPickup ? 'Ready for Pickup' : 'Ready'}</SelectItem>
                              {!isPickup && (
                                <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                              )}
                              <SelectItem value="delivered">{isPickup ? 'Picked Up' : 'Delivered'}</SelectItem>
                              <SelectItem value="cancelled">Reject Order</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow className={cn('hover:bg-transparent', rowGroupStyles[group])}>
                          <TableCell colSpan={10} className="bg-background/50 py-4">
                            <div className="space-y-3">
                              <div className="text-xs font-medium text-muted-foreground">Order Items</div>

                              {order.order_items?.length > 0 ? (
                                <div className="space-y-2">
                                  {order.order_items.map((item: any, idx: number) => (
                                    <div key={item.id || idx} className="rounded-md border border-border/60 bg-background/40 px-3 py-2">
                                      <div className="flex items-start justify-between gap-3 text-sm">
                                        <span className="font-medium">{item.quantity}× {item.menu_items?.name || 'Item'}</span>
                                        <span className="text-muted-foreground">€{Number(item.total_price).toFixed(2)}</span>
                                      </div>
                                      {item.special_instructions && (
                                        <p className="mt-1 max-w-full break-words [word-break:break-word] text-xs italic text-muted-foreground">
                                          📝 {item.special_instructions}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground">No order items</div>
                              )}

                              {order.order_type === 'delivery' && (order.guest_delivery_address || order.delivery_address_id) && (
                                <div className="text-xs text-muted-foreground">
                                  <span className="font-medium">Delivery: </span>
                                  {order.guest_delivery_address || 'Saved address'}
                                </div>
                              )}

                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <span>Subtotal: €{Number(order.subtotal).toFixed(2)}</span>
                                {order.delivery_fee > 0 && <span>Delivery: €{Number(order.delivery_fee).toFixed(2)}</span>}
                                {order.tip > 0 && <span>Tip: €{Number(order.tip).toFixed(2)}</span>}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>

          <MobileOrderCards
            orders={filteredOrders}
            updateStatusMutation={updateStatusMutation}
          />
        </Card>
      </div>
    </AdminLayout>
  );
}
