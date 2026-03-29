import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { format, isToday, isTomorrow } from 'date-fns';
import { 
  X, Check, MessageSquareText, ShoppingBag, User, MapPin, 
  Phone, Mail, UtensilsCrossed, AlertTriangle, Timer, ChevronRight, Ban,
  CalendarClock
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/currency';
import { StaffOrderMap } from '@/components/staff/StaffOrderMap';
import { GeocodedStaffMap } from '@/components/staff/GeocodedStaffMap';
import { isBranchOpen } from '@/lib/branch';
import { useStaffBranch } from '@/contexts/StaffBranchContext';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  preparing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  out_for_delivery: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  delivered: 'bg-muted text-muted-foreground',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const DECLINE_REASONS = [
  'Restaurant is too busy',
  'Item(s) out of stock',
  'Kitchen is closed',
  'Delivery area too far',
  'Invalid order details',
];

const NEXT_STATUS: Record<string, { next: string; label: string }> = {
  pending: { next: 'confirmed', label: 'Accept' },
  confirmed: { next: 'preparing', label: 'Start Preparing' },
  preparing: { next: 'ready', label: 'Mark Ready' },
  ready: { next: 'out_for_delivery', label: 'Out for Delivery' },
};

import { playOrderAlert } from '@/lib/notificationSound';

export const NewOrderPopup = () => {
  const queryClient = useQueryClient();
  const [newOrderPopup, setNewOrderPopup] = useState<any | null>(null);
  const { selectedBranchId: staffBranchId } = useStaffBranch();
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [estimatedMinutes, setEstimatedMinutes] = useState('30');
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [selectedDeclineReason, setSelectedDeclineReason] = useState('');
  const [customDeclineReason, setCustomDeclineReason] = useState('');
  const pendingScheduledOrders = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const alertIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Repeating alert sound — plays every 2s while popup is open with a pending order
  // Sound only stops when order is actually accepted/declined (popup dismissed)
  useEffect(() => {
    if (newOrderPopup?.status === 'pending') {
      playOrderAlert();
      alertIntervalRef.current = setInterval(() => {
        playOrderAlert();
      }, 2000);
    }
    return () => {
      if (alertIntervalRef.current) {
        clearInterval(alertIntervalRef.current);
        alertIntervalRef.current = null;
      }
    };
  }, [newOrderPopup]);

  // Fetch branch data for the staff member
  const { data: staffBranch } = useQuery({
    queryKey: ['staff-branch-data', staffBranchId],
    queryFn: async () => {
      if (!staffBranchId) return null;
      const { data } = await supabase
        .from('branches')
        .select('opens_at, closes_at')
        .eq('id', staffBranchId)
        .maybeSingle();
      return data;
    },
    enabled: !!staffBranchId,
  });

  // Fetch scheduled alert minutes setting
  const { data: tenantSettings } = useQuery({
    queryKey: ['tenant-settings-alert'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenant_settings')
        .select('scheduled_alert_minutes')
        .limit(1)
        .maybeSingle();
      return data;
    },
  });


  const fetchOrderDetails = useCallback(async (orderId: string) => {
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
    }
  }, []);

  // Real-time subscription for new orders — triggers popup on any staff page
  useEffect(() => {
    const channel = supabase
      .channel('staff-global-new-order-popup')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['staff-orders'] });
        queryClient.invalidateQueries({ queryKey: ['staff-pending-count'] });
        if (payload.new?.status === 'pending') {
          if (staffBranchId && payload.new?.branch_id === staffBranchId) {
            const isScheduled = !!payload.new.estimated_delivery_time;
            const branchOpen = staffBranch ? isBranchOpen(staffBranch.opens_at, staffBranch.closes_at) : true;

            if (isScheduled && !branchOpen) {
              // Branch is closed — delay showing the popup until X minutes before opening
              const alertMinutes = (tenantSettings as any)?.scheduled_alert_minutes ?? 30;
              const now = new Date();
              
              if (staffBranch?.opens_at) {
                const [oh, om] = staffBranch.opens_at.split(':').map(Number);
                const openTime = new Date();
                openTime.setHours(oh, om || 0, 0, 0);
                
                // If opening time already passed today, set for tomorrow
                if (openTime <= now) {
                  openTime.setDate(openTime.getDate() + 1);
                }
                
                const alertTime = new Date(openTime.getTime() - alertMinutes * 60000);
                const delayMs = alertTime.getTime() - now.getTime();
                
                if (delayMs > 0) {
                  // Schedule the popup for later
                  const timer = setTimeout(() => {
                    playOrderAlert();
                    toast.success('Scheduled order incoming!', { description: `Order #${payload.new.order_number}` });
                    fetchOrderDetails(payload.new.id);
                    pendingScheduledOrders.current.delete(payload.new.id);
                  }, delayMs);
                  pendingScheduledOrders.current.set(payload.new.id, timer);
                  console.log(`Scheduled order #${payload.new.order_number} popup delayed by ${Math.round(delayMs / 60000)} minutes`);
                  return;
                }
              }
            }

            // Show immediately (branch open, or alert time already passed)
            playOrderAlert();
            toast.success('New order received!', { description: `Order #${payload.new.order_number}` });
            fetchOrderDetails(payload.new.id);
          }
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      // Clear any pending timers
      pendingScheduledOrders.current.forEach(timer => clearTimeout(timer));
      pendingScheduledOrders.current.clear();
    };
  }, [queryClient, fetchOrderDetails, staffBranchId, staffBranch, tenantSettings]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, estimated_ready_at, cancellation_reason }: { id: string; status: string; estimated_ready_at?: string; cancellation_reason?: string }) => {
      const updateData: any = { status };
      if (estimated_ready_at) updateData.estimated_ready_at = estimated_ready_at;
      if (cancellation_reason) updateData.cancellation_reason = cancellation_reason;
      const { error } = await supabase.from('orders').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-orders'] });
      queryClient.invalidateQueries({ queryKey: ['staff-pending-count'] });
      toast.success('Order status updated');
    },
  });

  const handleAcceptOrder = () => {
    if (!newOrderPopup) return;
    const minutes = parseInt(estimatedMinutes);
    if (isNaN(minutes) || minutes < 1) {
      toast.error('Please enter a valid time estimate');
      return;
    }
    const estimatedReadyAt = new Date(Date.now() + minutes * 60000).toISOString();
    updateStatusMutation.mutate({ id: newOrderPopup.id, status: 'confirmed', estimated_ready_at: estimatedReadyAt });
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
    updateStatusMutation.mutate({ id: newOrderPopup.id, status: 'cancelled', cancellation_reason: reason });
    setShowDeclineDialog(false);
    setNewOrderPopup(null);
    setSelectedDeclineReason('');
    setCustomDeclineReason('');
  };

  return (
    <>
      {/* ============ Order Detail Popup ============ */}
      <Dialog open={!!newOrderPopup} onOpenChange={(open) => !open && setNewOrderPopup(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl flex-wrap">
              <ShoppingBag className="w-5 h-5 text-primary" />
              New Order
              {newOrderPopup?.status && (
                <Badge className={cn("ml-2 text-xs capitalize", statusColors[newOrderPopup.status])}>
                  {newOrderPopup.status === 'pending' ? 'New' : newOrderPopup.status.replace('_', ' ')}
                </Badge>
              )}
              {newOrderPopup?.estimated_delivery_time && (
                <Badge className="ml-1 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                  <CalendarClock className="w-3 h-3 mr-1" />
                  Scheduled
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Scheduled Order Banner */}
          {newOrderPopup?.estimated_delivery_time && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 flex items-start gap-3">
              <CalendarClock className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">
                  Scheduled for {(() => {
                    const dt = new Date(newOrderPopup.estimated_delivery_time);
                    if (isToday(dt)) return `Today at ${format(dt, 'HH:mm')}`;
                    if (isTomorrow(dt)) return `Tomorrow at ${format(dt, 'HH:mm')}`;
                    return format(dt, 'EEE, MMM dd \'at\' HH:mm');
                  })()}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-0.5">
                  This order should be prepared for the scheduled time, not immediately.
                </p>
              </div>
            </div>
          )}

          {newOrderPopup && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" /> Customer
                  </h3>
                  <div className="grid gap-1.5 text-sm">
                    <p className="font-medium">{newOrderPopup.profiles?.full_name || newOrderPopup.guest_name || 'Guest'}</p>
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

                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-primary" /> Order Info
                  </h3>
                  <div className="grid gap-1.5 text-sm">
                    <p className="capitalize"><span className="text-muted-foreground">Type:</span> {newOrderPopup.order_type?.replace('_', ' ')}</p>
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
                    
                    const hasUserCoords = newOrderPopup.user_addresses?.latitude && newOrderPopup.user_addresses?.longitude;
                    if (hasUserCoords) {
                      return (
                        <StaffOrderMap
                          branchLat={branchLat} branchLng={branchLng} branchName={branchName}
                          deliveryLat={Number(newOrderPopup.user_addresses.latitude)}
                          deliveryLng={Number(newOrderPopup.user_addresses.longitude)}
                          deliveryAddress={`${newOrderPopup.user_addresses.address_line1}, ${newOrderPopup.user_addresses.city}`}
                        />
                      );
                    }
                    
                    const hasGuestCoords = newOrderPopup.guest_delivery_lat && newOrderPopup.guest_delivery_lng;
                    if (hasGuestCoords) {
                      return (
                        <StaffOrderMap
                          branchLat={branchLat} branchLng={branchLng} branchName={branchName}
                          deliveryLat={Number(newOrderPopup.guest_delivery_lat)}
                          deliveryLng={Number(newOrderPopup.guest_delivery_lng)}
                          deliveryAddress={newOrderPopup.guest_delivery_address || 'Delivery location'}
                        />
                      );
                    }
                    
                    const addressText = newOrderPopup.user_addresses
                      ? `${newOrderPopup.user_addresses.address_line1}${newOrderPopup.user_addresses.address_line2 ? ', ' + newOrderPopup.user_addresses.address_line2 : ''}, ${newOrderPopup.user_addresses.city}`
                      : newOrderPopup.guest_delivery_address;
                    
                    if (addressText && addressText !== 'Pinned location') {
                      return (
                        <GeocodedStaffMap
                          branchLat={branchLat} branchLng={branchLng} branchName={branchName}
                          addressText={addressText}
                        />
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              <Separator />

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

          {newOrderPopup && NEXT_STATUS[newOrderPopup.status] && newOrderPopup.status !== 'pending' && (
            <DialogFooter className="pt-2">
              <Button
                className="w-full"
                onClick={() => {
                  const nextInfo = NEXT_STATUS[newOrderPopup.status];
                  updateStatusMutation.mutate({ id: newOrderPopup.id, status: nextInfo.next });
                  setNewOrderPopup({ ...newOrderPopup, status: nextInfo.next });
                }}
                disabled={updateStatusMutation.isPending}
              >
                {NEXT_STATUS[newOrderPopup.status].label}
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
                <Button key={mins} variant={estimatedMinutes === mins ? 'default' : 'outline'} size="sm" onClick={() => setEstimatedMinutes(mins)} className="flex-1">
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
                <Button key={reason} variant={selectedDeclineReason === reason ? 'default' : 'outline'} size="sm" className="w-full justify-start text-left"
                  onClick={() => { setSelectedDeclineReason(reason); setCustomDeclineReason(''); }}>
                  {reason}
                </Button>
              ))}
              <Button variant={selectedDeclineReason === 'other' ? 'default' : 'outline'} size="sm" className="w-full justify-start text-left"
                onClick={() => setSelectedDeclineReason('other')}>
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
};
