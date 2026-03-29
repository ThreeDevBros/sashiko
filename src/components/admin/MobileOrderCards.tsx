import { useState } from 'react';
import { formatOrderDisplayNumber } from '@/lib/orderNumber';
import { Badge } from '@/components/ui/badge';
import { CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { MessageSquareText, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type StatusGroup = 'in_progress' | 'completed' | 'failed';

const getStatusGroup = (status: string): StatusGroup => {
  if (['delivered', 'picked_up'].includes(status)) return 'completed';
  if (['cancelled', 'rejected'].includes(status)) return 'failed';
  return 'in_progress';
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

interface MobileOrderCardsProps {
  orders: any[] | undefined;
  updateStatusMutation: any;
}

export function MobileOrderCards({ orders, updateStatusMutation }: MobileOrderCardsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

  return (
    <CardContent className="p-2 space-y-2 lg:hidden">
      {orders?.map((order) => {
        const group = getStatusGroup(order.status);
        const isPickup = order.order_type === 'pickup' || order.order_type === 'dine_in';
        const isExpanded = expandedId === order.id;

        return (
          <div
            key={order.id}
            className={cn(
              'rounded-lg border transition-all',
              group === 'in_progress' && 'bg-yellow-500/10 border-yellow-500/30',
              group === 'completed' && 'bg-green-500/10 border-green-500/30',
              group === 'failed' && 'bg-red-500/10 border-red-500/30',
            )}
          >
            {/* Clickable summary area */}
            <button
              type="button"
              className="w-full text-left p-5 space-y-3"
              onClick={() => toggle(order.id)}
            >
              {/* Header: Order # + Status pill + chevron */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm break-all">#{formatOrderDisplayNumber(order.display_number)}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge className={cn('border text-xs', badgeGroupStyles[group])}>
                    {getStatusLabel(order.status, order.order_type)}
                  </Badge>
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
              </div>

              {/* Customer + Branch */}
              <div className="space-y-0.5">
                <div className="text-sm font-medium">{order.profiles?.full_name || order.guest_name || 'Guest'}</div>
                <div className="text-xs text-muted-foreground break-words">{order.branches?.name}</div>
              </div>

              {/* Type + Items + Total */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                <span><span className="text-[11px] text-muted-foreground mr-1">Type</span> <span className="capitalize">{order.order_type?.replace('_', ' ')}</span></span>
                <span><span className="text-[11px] text-muted-foreground mr-1">Items</span> {order.order_items?.length || 0}</span>
                <span><span className="text-[11px] text-muted-foreground mr-1">Total</span> <span className="font-semibold">€{Number(order.total).toFixed(2)}</span></span>
              </div>

              {/* Date */}
              <div className="text-xs text-muted-foreground">
                {format(new Date(order.created_at), 'MMM dd, yyyy · HH:mm')}
              </div>
            </button>

            {/* Actions dropdown — always visible */}
            <div className="px-5 pb-4" onClick={(e) => e.stopPropagation()}>
              <Select
                value={order.status}
                disabled={updateStatusMutation.isPending}
                onValueChange={(value: any) =>
                  updateStatusMutation.mutate({ id: order.id, status: value })
                }
              >
                <SelectTrigger className={cn(
                  'w-full h-11 border text-sm',
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
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div className="px-5 pb-5 space-y-3 border-t border-border/40 pt-3">
                {/* Notes */}
                {order.special_instructions ? (
                  <div className="flex items-start gap-1.5">
                    <MessageSquareText className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground break-words whitespace-pre-wrap">{order.special_instructions}</span>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No special instructions</div>
                )}

                {/* Order items list */}
                {order.order_items?.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-medium">Order Items</div>
                    {order.order_items.map((item: any, idx: number) => (
                      <div key={item.id || idx}>
                        <div className="flex justify-between text-sm">
                          <span>{item.quantity}× {item.menu_items?.name || 'Item'}</span>
                          <span className="text-muted-foreground">€{Number(item.total_price).toFixed(2)}</span>
                        </div>
                        {item.special_instructions && (
                          <p className="text-xs text-primary italic ml-4 mt-0.5 border-l-2 border-primary/30 pl-2 w-full max-w-full break-words [word-break:break-word]">
                            📝 {item.special_instructions}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Delivery address if applicable */}
                {order.order_type === 'delivery' && (order.guest_delivery_address || order.delivery_address_id) && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Delivery: </span>
                    {order.guest_delivery_address || 'Saved address'}
                  </div>
                )}

                {/* Subtotal breakdown */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Subtotal: €{Number(order.subtotal).toFixed(2)}</span>
                  {order.delivery_fee > 0 && <span>Delivery: €{Number(order.delivery_fee).toFixed(2)}</span>}
                  {order.tip > 0 && <span>Tip: €{Number(order.tip).toFixed(2)}</span>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </CardContent>
  );
}
