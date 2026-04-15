import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StaffLayout } from '@/components/staff/StaffLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { format, isToday, isYesterday } from 'date-fns';
import { Search, X, Check, MessageSquareText, ShoppingBag, User, MapPin, Phone, Mail, Clock, UtensilsCrossed, AlertTriangle, Timer, ChevronRight, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatOrderDisplayNumber } from '@/lib/orderNumber';
import { useOrderAlerts } from '@/hooks/useOrderAlerts';
import { formatCurrency } from '@/lib/currency';
import { StaffOrderMap } from '@/components/staff/StaffOrderMap';
import { GeocodedStaffMap } from '@/components/staff/GeocodedStaffMap';
import { PauseBranchButton } from '@/components/PauseBranchButton';
import { useStaffBranch } from '@/contexts/StaffBranchContext';
import { subscribeToResume } from '@/lib/lifecycleManager';

// ── Status → color-group mapping ──
type StatusGroup = 'in_progress' | 'completed' | 'failed';

const getStatusGroup = (status: string): StatusGroup => {
  if (['delivered', 'picked_up'].includes(status)) return 'completed';
  if (['cancelled', 'rejected'].includes(status)) return 'failed';
  return 'in_progress';
};

const rowGroupStyles: Record<StatusGroup, string> = {
  in_progress: 'bg-yellow-500/10 border-l-2 border-l-yellow-500',
  completed: 'bg-green-500/10 border-l-2 border-l-green-500',
  failed: 'bg-red-500/10 border-l-2 border-l-red-500',
};

const badgeGroupStyles: Record<StatusGroup, string> = {
  in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
};

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

const DECLINE_REASONS = [
  'Restaurant is too busy',
  'Item(s) out of stock',
  'Kitchen is closed',
  'Delivery area too far',
  'Invalid order details',
];

// Next state flow for staff — depends on order type
const getNextStatus = (status: string, orderType: string): { next: string; label: string } | null => {
  const isDelivery = orderType === 'delivery';
  const flow: Record<string, { next: string; label: string }> = {
    pending: { next: 'confirmed', label: 'Accept' },
    confirmed: { next: 'preparing', label: 'Start Preparing' },
    preparing: { next: 'ready', label: isDelivery ? 'Mark Ready' : 'Ready for Pickup' },
    // For delivery orders, staff stops at 'ready' — the driver handles 'out_for_delivery' and 'delivered'
    // For pickup/dine-in, staff can mark as picked up
    ...(!isDelivery
      ? { ready: { next: 'delivered', label: 'Picked Up' } }
      : {}),
  };
  return flow[status] || null;
};

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'] as const;

function StaffOrdersContent() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [newOrderPopup, setNewOrderPopup] = useState<any | null>(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const { selectedBranchId: staffBranchId, selectedBranchName: staffBranchName } = useStaffBranch();

  // Accept flow state
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [estimatedMinutes, setEstimatedMinutes] = useState('30');

  // Decline flow state
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [selectedDeclineReason, setSelectedDeclineReason] = useState('');
  const [customDeclineReason, setCustomDeclineReason] = useState('');

  const fetchOrderDetails = useCallback(async (orderId: string) => {
    setLoadingOrderDetails(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          profiles:user_id(full_name, phone, avatar_url),
          branches:branch_id(name, address, latitude, longitude),
          order_items(
            *,
            menu_items:menu_item_id(name, image_url)
          ),
          user_addresses:delivery_address_id(address_line1, address_line2, city, latitude, longitude, postal_code)
        `)
        .eq('id', orderId)
        .single();
      if (error) throw error;

      if (data?.order_items?.length) {
        const itemIds = data.order_items.map((i: any) => i.id);
        const { data: modifiers } = await supabase
          .from('order_item_modifiers')
          .select('*, modifiers:modifier_id(name, price_adjustment)')
          .in('order_item_id', itemIds);

        if (modifiers) {
          data.order_items = data.order_items.map((item: any) => ({
            ...item,
            order_item_modifiers: modifiers.filter((m: any) => m.order_item_id === item.id),
          }));
        }
      }

      setNewOrderPopup(data);
    } catch (err) {
      console.error('Failed to fetch order details:', err);
    } finally {
      setLoadingOrderDetails(false);
    }
  }, []);

  // Resume counter to force realtime reconnect after backgrounding
  const [resumeCounter, setResumeCounter] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToResume(() => {
      setResumeCounter(prev => prev + 1);
      queryClient.invalidateQueries({ queryKey: ['staff-orders', staffBranchId] });
    });

    return unsubscribe;
  }, [queryClient, staffBranchId]);

  // Real-time subscription for order updates (reconnects on resume)
  useEffect(() => {
    const channel = supabase
      .channel(`staff-orders-realtime-${resumeCounter}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['staff-orders', staffBranchId] });
        queryClient.invalidateQueries({ queryKey: ['staff-pending-count'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, staffBranchId, resumeCounter]);

  // Auto-progression
  useEffect(() => {
    const checkAutoProgression = async () => {
      if (!staffBranchId) return;
      
      // Fetch automation settings from tenant_settings
      const { data: settings } = await supabase
        .from('tenant_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      const prepEnabled = (settings as any)?.auto_prepare_enabled ?? true;
      const prepPercent = (settings as any)?.auto_prepare_percent ?? 50;
      const readyEnabled = (settings as any)?.auto_ready_enabled ?? true;

      if (!prepEnabled && !readyEnabled) return;

      const { data: activeOrders } = await supabase
        .from('orders')
        .select('id, status, estimated_ready_at, created_at')
        .in('status', ['confirmed', 'preparing'])
        .eq('branch_id', staffBranchId)
        .not('estimated_ready_at', 'is', null);

      if (!activeOrders?.length) return;

      const now = new Date();
      let changed = false;

      for (const order of activeOrders) {
        const readyAt = new Date(order.estimated_ready_at);
        const createdAt = new Date(order.created_at);
        const totalPrepMs = readyAt.getTime() - createdAt.getTime();
        const elapsedMs = now.getTime() - createdAt.getTime();
        const msLeft = readyAt.getTime() - now.getTime();

        // When configured % of prep time has elapsed, move confirmed → preparing
        if (prepEnabled && order.status === 'confirmed' && totalPrepMs > 0 && elapsedMs >= (totalPrepMs * prepPercent) / 100) {
          const { error } = await supabase.from('orders').update({ status: 'preparing' }).eq('id', order.id).eq('status', 'confirmed');
          if (!error) changed = true;
        }

        // When estimated time is reached, move to ready
        if (readyEnabled && msLeft <= 0) {
          const { error } = await supabase.from('orders').update({ status: 'ready' }).eq('id', order.id).in('status', ['confirmed', 'preparing']);
          if (!error) changed = true;
        }
      }

      if (changed) {
        queryClient.invalidateQueries({ queryKey: ['staff-orders'] });
      }
    };

    // Run immediately on mount, then every 30s
    checkAutoProgression();
    const interval = setInterval(checkAutoProgression, 30000);

    return () => clearInterval(interval);
  }, [queryClient, staffBranchId]);

  const { data: orders, isLoading, error: ordersError } = useQuery({
    queryKey: ['staff-orders', staffBranchId],
    queryFn: async () => {
      if (!staffBranchId) return [];
      const { data, error } = await supabase
        .from('orders')
        .select(`*, profiles:user_id(full_name), branches:branch_id(name), order_items(*)`)
        .in('status', ACTIVE_STATUSES)
        .eq('branch_id', staffBranchId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Staff orders query failed:', error);
        throw error;
      }
      return data;
    },
    enabled: !!staffBranchId,
  });

  const pendingOrderIds = useMemo(() =>
    orders?.filter(o => o.status === 'pending').map(o => o.id) || [], [orders]);
  useOrderAlerts(pendingOrderIds);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, estimated_ready_at, cancellation_reason }: { id: string; status: string; estimated_ready_at?: string; cancellation_reason?: string }) => {
      const updateData: any = { status };
      if (estimated_ready_at) updateData.estimated_ready_at = estimated_ready_at;
      if (cancellation_reason) updateData.cancellation_reason = cancellation_reason;
      const { error } = await supabase.from('orders').update(updateData).eq('id', id);
      if (error) throw error;

      // If cancelling, trigger Stripe refund
      if (status === 'cancelled') {
        try {
          console.log('[Staff Refund] Invoking refund-order for order:', id);
          const { data: refundData, error: refundErr } = await supabase.functions.invoke('refund-order', { body: { order_id: id } });
          console.log('[Staff Refund] Response:', { refundData, refundErr });
          if (refundErr) {
            console.error('[Staff Refund] Error:', refundErr);
            toast.error('Refund failed', { description: refundErr.message || 'Could not process automatic refund.', duration: 10000 });
          } else if (refundData?.refunded) {
            toast.success('Refund issued', { description: 'Payment has been refunded.', duration: 5000 });
          } else if (refundData?.reason === 'cash_order') {
            console.log('[Staff Refund] Cash order — no refund needed');
          } else if (refundData?.reason) {
            console.log('[Staff Refund] Skipped:', refundData.reason);
          }
        } catch (e: any) {
          console.error('[Staff Refund] Exception:', e);
          toast.error('Refund error', { description: 'Unexpected error processing refund.', duration: 10000 });
        }
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
      queryClient.invalidateQueries({ queryKey: ['staff-orders'] });
      queryClient.invalidateQueries({ queryKey: ['staff-pending-count'] });
      toast.success('Order status updated');
    },
  });

  const filteredOrders = orders?.filter(order => {
    const searchLower = searchQuery.toLowerCase();
    return !searchQuery || (
      order.order_number?.toLowerCase().includes(searchLower) ||
      order.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      order.guest_name?.toLowerCase().includes(searchLower)
    );
  });

  const handleAcceptOrder = () => {
    if (!newOrderPopup) return;
    const minutes = parseInt(estimatedMinutes);
    if (isNaN(minutes) || minutes < 1) {
      toast.error('Please enter a valid time estimate');
      return;
    }
    const estimatedReadyAt = new Date(Date.now() + minutes * 60000).toISOString();
    updateStatusMutation.mutate({
      id: newOrderPopup.id,
      status: 'confirmed',
      estimated_ready_at: estimatedReadyAt,
    });
    setShowAcceptDialog(false);
    setNewOrderPopup(null);
    setEstimatedMinutes('30');
  };

  const handleDeclineOrder = () => {
    if (!newOrderPopup) return;
    const reason = selectedDeclineReason === 'other' ? customDeclineReason : selectedDeclineReason;
    if (!reason.trim()) {
      toast.error('Please select or enter a reason');
      return;
    }
    updateStatusMutation.mutate({
      id: newOrderPopup.id,
      status: 'cancelled',
      cancellation_reason: reason,
    });
    setShowDeclineDialog(false);
    setNewOrderPopup(null);
    setSelectedDeclineReason('');
    setCustomDeclineReason('');
  };

  // Format time smartly: if today show time only, otherwise show date + time
  const formatOrderTime = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isToday(d)) return format(d, 'HH:mm');
    if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
    return format(d, 'MMM d, HH:mm');
  };

  // Handle inline next-state action
  const handleNextStatus = (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    const nextInfo = getNextStatus(order.status, order.order_type);
    if (!nextInfo) return;

    if (order.status === 'pending') {
      fetchOrderDetails(order.id);
      return;
    }

    updateStatusMutation.mutate({ id: order.id, status: nextInfo.next });
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Orders</h1>
            <p className="text-muted-foreground text-xs">Monitor and manage all orders</p>
          </div>
          <div className="flex items-center gap-2">
            {staffBranchName && (
              <span className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">
                📍 {staffBranchName}
              </span>
            )}
            <PauseBranchButton branchId={staffBranchId} />
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search order #, customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9 text-sm"
          />
        </div>

        {/* Orders Table */}
        {ordersError ? (
          <div className="text-center py-12 space-y-2">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-sm text-destructive">Failed to load orders</p>
            <p className="text-xs text-muted-foreground">{(ordersError as Error).message}</p>
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['staff-orders', staffBranchId] })}>
              Retry
            </Button>
          </div>
        ) : isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading orders...</div>
        ) : filteredOrders && filteredOrders.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Order #</TableHead>
                  <TableHead className="text-xs">Customer</TableHead>
                  <TableHead className="text-xs">Time</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                  <TableHead className="text-xs">Payment</TableHead>
                  <TableHead className="text-xs">Notes</TableHead>
                  <TableHead className="text-xs w-[130px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const nextInfo = getNextStatus(order.status || '', order.order_type);
                  const isStaffActionable = !!nextInfo;

                  const group = getStatusGroup(order.status || 'pending');

                  return (
                    <TableRow
                      key={order.id}
                      className={cn("cursor-pointer", rowGroupStyles[group])}
                      onClick={() => fetchOrderDetails(order.id)}
                    >
                      <TableCell className="font-mono text-xs py-2.5">#{formatOrderDisplayNumber(order.display_number)}</TableCell>
                      <TableCell className="text-xs py-2.5">{order.user_id ? (order.profiles?.full_name || order.guest_name || order.guest_email || 'Registered customer') : (order.guest_name || order.guest_email || 'Guest')}</TableCell>
                      <TableCell className="text-xs py-2.5 text-muted-foreground">{formatOrderTime(order.created_at)}</TableCell>
                      <TableCell className="py-2.5">
                        <Badge variant="outline" className="text-[10px] capitalize px-1.5 py-0">{order.order_type.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge className={cn("text-[10px] px-1.5 py-0 border", badgeGroupStyles[group])}>
                          {getStatusLabel(order.status || 'pending', order.order_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium py-2.5 text-right">{formatCurrency(Number(order.total))}</TableCell>
                      <TableCell className="py-2.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {(order.payment_method || (order.stripe_payment_intent_id ? 'card' : 'cash')) === 'card' ? '💳 Card' : '💵 Cash'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5">
                        {order.special_instructions ? (
                          <MessageSquareText className="h-3.5 w-3.5 text-primary" />
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="py-2.5" onClick={(e) => e.stopPropagation()}>
                        {isStaffActionable ? (
                          <Button
                            size="sm"
                            className="h-7 text-[11px] gap-1"
                            variant={order.status === 'pending' ? 'default' : 'outline'}
                            onClick={(e) => handleNextStatus(e, order)}
                            disabled={updateStatusMutation.isPending}
                          >
                            {nextInfo.label}
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                        ) : order.status === 'cancelled' ? (
                          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                            <Ban className="w-3 h-3 mr-0.5" /> Rejected
                          </Badge>
                        ) : order.order_type === 'delivery' && order.status === 'ready' ? (
                          <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-500">
                            <Clock className="w-3 h-3 mr-0.5" /> Awaiting Driver
                          </Badge>
                        ) : order.order_type === 'delivery' && order.status === 'out_for_delivery' ? (
                          <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-500">
                            <ChevronRight className="w-3 h-3 mr-0.5" /> In Transit
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground text-sm">No orders found</div>
        )}
      </div>

      {/* ============ Order Detail Popup ============ */}
      <Dialog open={!!newOrderPopup} onOpenChange={(open) => !open && setNewOrderPopup(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ShoppingBag className="w-5 h-5 text-primary" />
              Order #{formatOrderDisplayNumber(newOrderPopup?.display_number)}
              {newOrderPopup?.status && (
                <Badge className={cn("ml-2 text-xs border", badgeGroupStyles[getStatusGroup(newOrderPopup.status)])}>
                  {newOrderPopup.status === 'pending' ? 'New' : getStatusLabel(newOrderPopup.status, newOrderPopup.order_type)}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {newOrderPopup && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Customer Info */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" /> Customer
                  </h3>
                  <div className="grid gap-1.5 text-sm">
                    <p className="font-medium">{newOrderPopup.user_id ? (newOrderPopup.profiles?.full_name || newOrderPopup.guest_name || newOrderPopup.guest_email || 'Registered customer') : (newOrderPopup.guest_name || newOrderPopup.guest_email || 'Guest')}</p>
                    {(newOrderPopup.profiles?.phone || newOrderPopup.guest_phone) && (
                      <a href={`tel:${newOrderPopup.profiles?.phone || newOrderPopup.guest_phone}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary">
                        <Phone className="w-3.5 h-3.5" />
                        {newOrderPopup.profiles?.phone || newOrderPopup.guest_phone}
                      </a>
                    )}
                    {newOrderPopup.guest_email && (
                      <p className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="w-3.5 h-3.5" />
                        {newOrderPopup.guest_email}
                      </p>
                    )}
                  </div>
                </div>

                {/* Order Meta */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-primary" /> Order Info
                  </h3>
                  <div className="grid gap-1.5 text-sm">
                    <p className="capitalize"><span className="text-muted-foreground">Type:</span> {newOrderPopup.order_type?.replace('_', ' ')}</p>
                    <p><span className="text-muted-foreground">Payment:</span> {(newOrderPopup.payment_method || (newOrderPopup.stripe_payment_intent_id ? 'card' : 'cash')) === 'card' ? '💳 Card' : '💵 Cash'}</p>
                    <p><span className="text-muted-foreground">Time:</span> {format(new Date(newOrderPopup.created_at), 'MMM dd, HH:mm')}</p>
                    {newOrderPopup.branches?.name && (
                      <p><span className="text-muted-foreground">Branch:</span> {newOrderPopup.branches.name}</p>
                    )}
                    {newOrderPopup.estimated_ready_at && (
                      <p className="flex items-center gap-1">
                        <Timer className="w-3.5 h-3.5 text-primary" />
                        <span className="text-muted-foreground">Ready by:</span> {format(new Date(newOrderPopup.estimated_ready_at), 'HH:mm')}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Delivery Address & Map */}
              {newOrderPopup.order_type === 'delivery' && (
                <div className="rounded-lg border p-4 space-y-2">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" /> Delivery Address
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {newOrderPopup.user_addresses
                      ? `${newOrderPopup.user_addresses.address_line1}${newOrderPopup.user_addresses.address_line2 ? ', ' + newOrderPopup.user_addresses.address_line2 : ''}, ${newOrderPopup.user_addresses.city}${newOrderPopup.user_addresses.postal_code ? ' ' + newOrderPopup.user_addresses.postal_code : ''}`
                      : newOrderPopup.guest_delivery_address || '—'}
                  </p>
                  {newOrderPopup.branches?.latitude && newOrderPopup.branches?.longitude && (() => {
                    const branchLat = Number(newOrderPopup.branches.latitude);
                    const branchLng = Number(newOrderPopup.branches.longitude);
                    const branchName = newOrderPopup.branches.name || 'Branch';
                    
                    // Registered user with address coordinates
                    const hasUserCoords = newOrderPopup.user_addresses?.latitude && newOrderPopup.user_addresses?.longitude;
                    if (hasUserCoords) {
                      return (
                        <StaffOrderMap
                          branchLat={branchLat}
                          branchLng={branchLng}
                          branchName={branchName}
                          deliveryLat={Number(newOrderPopup.user_addresses.latitude)}
                          deliveryLng={Number(newOrderPopup.user_addresses.longitude)}
                          deliveryAddress={`${newOrderPopup.user_addresses.address_line1}, ${newOrderPopup.user_addresses.city}`}
                        />
                      );
                    }
                    
                    // Guest with stored coordinates
                    const hasGuestCoords = newOrderPopup.guest_delivery_lat && newOrderPopup.guest_delivery_lng;
                    if (hasGuestCoords) {
                      return (
                        <StaffOrderMap
                          branchLat={branchLat}
                          branchLng={branchLng}
                          branchName={branchName}
                          deliveryLat={Number(newOrderPopup.guest_delivery_lat)}
                          deliveryLng={Number(newOrderPopup.guest_delivery_lng)}
                          deliveryAddress={newOrderPopup.guest_delivery_address || 'Delivery location'}
                        />
                      );
                    }
                    
                    // Fallback: geocode from text address
                    const addressText = newOrderPopup.user_addresses
                      ? `${newOrderPopup.user_addresses.address_line1}${newOrderPopup.user_addresses.address_line2 ? ', ' + newOrderPopup.user_addresses.address_line2 : ''}, ${newOrderPopup.user_addresses.city}`
                      : newOrderPopup.guest_delivery_address;
                    
                    if (addressText && addressText !== 'Pinned location') {
                      return (
                        <GeocodedStaffMap
                          branchLat={branchLat}
                          branchLng={branchLng}
                          branchName={branchName}
                          addressText={addressText}
                        />
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              <Separator />

              {/* Order Items */}
              <div>
                <h3 className="font-semibold text-sm mb-2">Order Items</h3>
                <div className="space-y-2">
                  {newOrderPopup.order_items?.map((item: any) => (
                    <div key={item.id} className="flex items-start justify-between py-2 px-3 rounded-md bg-muted/30 border">
                      <div className="flex items-start gap-3">
                        {item.menu_items?.image_url && (
                          <img src={item.menu_items.image_url} alt={item.menu_items?.name} className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{item.menu_items?.name || 'Unknown item'}</p>
                          <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                          {item.order_item_modifiers?.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {item.order_item_modifiers.map((mod: any) => (
                                <p key={mod.id} className="text-xs text-muted-foreground">
                                  + {mod.modifiers?.name}{mod.modifiers?.price_adjustment > 0 ? ` (+${formatCurrency(Number(mod.modifiers.price_adjustment))})` : ''}
                                </p>
                              ))}
                            </div>
                          )}
                          {item.special_instructions && (
                            <p className="mt-1 max-w-full border-l-2 border-primary/40 pl-2 text-xs text-muted-foreground italic break-words [word-break:break-word]">📝 {item.special_instructions}</p>
                          )}
                        </div>
                      </div>
                      <span className="font-medium text-sm flex-shrink-0">{formatCurrency(Number(item.total_price))}</span>
                    </div>
                  ))}
                </div>
              </div>

              {newOrderPopup.special_instructions && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="text-xs font-medium text-primary mb-1 flex items-center gap-1">
                    <MessageSquareText className="w-3.5 h-3.5" /> Special Instructions
                  </p>
                  <p className="text-sm select-all">{newOrderPopup.special_instructions}</p>
                </div>
              )}

              {newOrderPopup.status === 'cancelled' && newOrderPopup.cancellation_reason && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-xs font-medium text-destructive mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Cancellation Reason
                  </p>
                  <p className="text-sm">{newOrderPopup.cancellation_reason}</p>
                </div>
              )}

              <Separator />

              {/* Totals */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(Number(newOrderPopup.subtotal))}</span>
                </div>
                {Number(newOrderPopup.delivery_fee) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span>{formatCurrency(Number(newOrderPopup.delivery_fee))}</span>
                  </div>
                )}
                {Number(newOrderPopup.tax) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatCurrency(Number(newOrderPopup.tax))}</span>
                  </div>
                )}
                {Number(newOrderPopup.tip) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tip</span>
                    <span>{formatCurrency(Number(newOrderPopup.tip))}</span>
                  </div>
                )}
                {Number(newOrderPopup.cashback_used) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Cashback Used</span>
                    <span>-{formatCurrency(Number(newOrderPopup.cashback_used))}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-base pt-1">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(Number(newOrderPopup.total))}</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions for pending */}
          {newOrderPopup?.status === 'pending' && (
            <DialogFooter className="flex gap-2 sm:gap-2 pt-2">
              <Button variant="destructive" className="flex-1" onClick={() => setShowDeclineDialog(true)} disabled={updateStatusMutation.isPending}>
                <X className="w-4 h-4 mr-1" /> Decline
              </Button>
              <Button className="flex-1" onClick={() => setShowAcceptDialog(true)} disabled={updateStatusMutation.isPending}>
                <Check className="w-4 h-4 mr-1" /> Accept
              </Button>
            </DialogFooter>
          )}

          {/* Next-state action for active orders */}
          {newOrderPopup && getNextStatus(newOrderPopup.status, newOrderPopup.order_type) && newOrderPopup.status !== 'pending' && (
            <DialogFooter className="pt-2">
              <Button
                className="w-full"
                onClick={() => {
                  const nextInfo = getNextStatus(newOrderPopup.status, newOrderPopup.order_type)!;
                  updateStatusMutation.mutate({ id: newOrderPopup.id, status: nextInfo.next });
                  setNewOrderPopup({ ...newOrderPopup, status: nextInfo.next });
                }}
                disabled={updateStatusMutation.isPending}
              >
                {getNextStatus(newOrderPopup.status, newOrderPopup.order_type)!.label}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ============ Accept Dialog ============ */}
      <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-primary" />
              Preparation Time
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">How many minutes until ready?</p>
            <div className="flex gap-2">
              {['15', '20', '30', '45', '60'].map((mins) => (
                <Button
                  key={mins}
                  variant={estimatedMinutes === mins ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEstimatedMinutes(mins)}
                  className="flex-1"
                >
                  {mins}m
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Custom:</span>
              <Input type="number" min="1" max="180" value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value)} className="w-24" />
              <span className="text-sm text-muted-foreground">min</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAcceptDialog(false)}>Cancel</Button>
            <Button onClick={handleAcceptOrder} disabled={updateStatusMutation.isPending}>
              <Check className="w-4 h-4 mr-1" /> Accept Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ Decline Dialog ============ */}
      <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Decline Order
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Select a reason:</p>
            <div className="space-y-2">
              {DECLINE_REASONS.map((reason) => (
                <Button
                  key={reason}
                  variant={selectedDeclineReason === reason ? 'default' : 'outline'}
                  size="sm"
                  className="w-full justify-start text-left"
                  onClick={() => { setSelectedDeclineReason(reason); setCustomDeclineReason(''); }}
                >
                  {reason}
                </Button>
              ))}
              <Button
                variant={selectedDeclineReason === 'other' ? 'default' : 'outline'}
                size="sm"
                className="w-full justify-start text-left"
                onClick={() => setSelectedDeclineReason('other')}
              >
                Other reason...
              </Button>
            </div>
            {selectedDeclineReason === 'other' && (
              <Textarea placeholder="Enter reason..." value={customDeclineReason} onChange={(e) => setCustomDeclineReason(e.target.value)} maxLength={300} className="mt-2" />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeclineDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeclineOrder} disabled={updateStatusMutation.isPending}>
              <X className="w-4 h-4 mr-1" /> Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function StaffOrders() {
  return (
    <StaffLayout>
      <StaffOrdersContent />
    </StaffLayout>
  );
}
