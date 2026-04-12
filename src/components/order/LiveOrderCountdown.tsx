import { useEffect, useState, useMemo, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Clock, ChefHat, Truck, CheckCircle2, Timer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LiveOrderCountdownProps {
  orderType: 'delivery' | 'pickup' | 'dine_in';
  status: string;
  estimatedReadyAt: string | null;
  deliveryTransitMinutes?: number | null;
  onTransitMinutesCalculated?: (minutes: number) => void;
  onRemainingMinutesChange?: (minutes: number | null) => void;
  branchLat?: number;
  branchLng?: number;
  deliveryLat?: number;
  deliveryLng?: number;
  guestDeliveryLat?: number | null;
  guestDeliveryLng?: number | null;
}

const STATUS_META: Record<string, { icon: typeof Clock; label: string; color: string; bgColor: string }> = {
  pending: { icon: Clock, label: 'Waiting for confirmation', color: 'text-amber-500', bgColor: 'bg-amber-500/15' },
  confirmed: { icon: CheckCircle2, label: 'Order confirmed', color: 'text-blue-500', bgColor: 'bg-blue-500/15' },
  preparing: { icon: ChefHat, label: 'Being prepared', color: 'text-orange-500', bgColor: 'bg-orange-500/15' },
  ready: { icon: CheckCircle2, label: 'Ready!', color: 'text-green-500', bgColor: 'bg-green-500/15' },
  out_for_delivery: { icon: Truck, label: 'On its way', color: 'text-primary', bgColor: 'bg-primary/15' },
};

export function LiveOrderCountdown({
  orderType,
  status,
  estimatedReadyAt,
  deliveryTransitMinutes,
  onRemainingMinutesChange,
}: LiveOrderCountdownProps) {
  const [now, setNow] = useState(Date.now());

  // Tick every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const transitMinutes = deliveryTransitMinutes ?? null;

  // Calculate remaining minutes — same formula as server-side edge functions
  const remainingMinutes = useMemo(() => {
    if (['delivered', 'cancelled'].includes(status)) return null;
    if (status === 'pending') return null;
    if (status === 'ready' && orderType === 'pickup') return 0;

    // Prep remaining from estimated_ready_at
    let prepRemaining = 0;
    if (estimatedReadyAt && !['ready', 'out_for_delivery'].includes(status)) {
      const diffMs = new Date(estimatedReadyAt).getTime() - now;
      prepRemaining = Math.max(0, Math.ceil(diffMs / 60_000));
    }

    // For out_for_delivery, only transit time matters
    if (status === 'out_for_delivery') {
      // Fallback to ~15 min if transit minutes not yet computed
      return transitMinutes ?? 15;
    }

    // For ready + delivery, transit time only
    if (status === 'ready' && orderType === 'delivery') {
      return transitMinutes ?? 15;
    }

    // For confirmed/preparing: prep + transit (delivery) or prep only
    if (orderType === 'delivery') {
      // Show prep time even if transit is unknown (don't block on missing transit)
      return prepRemaining + (transitMinutes ?? 0);
    }

    return prepRemaining > 0 ? prepRemaining : 0;
  }, [status, estimatedReadyAt, now, transitMinutes, orderType]);

  // Notify parent whenever remainingMinutes changes (for Live Activity sync)
  const onRemainingMinutesChangeRef = useRef(onRemainingMinutesChange);
  onRemainingMinutesChangeRef.current = onRemainingMinutesChange;
  useEffect(() => {
    onRemainingMinutesChangeRef.current?.(remainingMinutes);
  }, [remainingMinutes]);

  if (['delivered', 'cancelled'].includes(status)) return null;

  const meta = STATUS_META[status] || STATUS_META.pending;
  const StatusIcon = meta.icon;

  const formatRemaining = (mins: number) => {
    if (mins === 0) return 'Now';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const progressLabel = orderType === 'pickup'
    ? 'Estimated pickup'
    : orderType === 'delivery'
      ? 'Estimated delivery'
      : 'Estimated ready';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="overflow-hidden border-none shadow-lg">
          <div className={`${meta.bgColor} p-5`}>
            <div className="flex items-center gap-4">
              {/* Animated icon */}
              <div className="relative">
                <div className={`p-3 rounded-2xl bg-card shadow-sm ${meta.color}`}>
                  <StatusIcon className="h-6 w-6" />
                </div>
                {status !== 'ready' && remainingMinutes !== 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-50" style={{ color: 'var(--primary)' }} />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {meta.label}
                </p>

                {status === 'pending' ? (
                  <p className="text-xl font-bold text-foreground mt-0.5">
                    Awaiting confirmation…
                  </p>
                ) : remainingMinutes != null ? (
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {remainingMinutes === 0 ? 'Ready now!' : `~${formatRemaining(remainingMinutes)}`}
                    </p>
                    {remainingMinutes > 0 && (
                      <span className="text-xs text-muted-foreground">{progressLabel}</span>
                    )}
                  </div>
                ) : (
                  <p className="text-xl font-bold text-foreground mt-0.5">
                    Processing…
                  </p>
                )}
              </div>

              {/* Live indicator */}
              {remainingMinutes != null && remainingMinutes > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card/80 border border-border/50">
                  <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Live</span>
                </div>
              )}
            </div>

            {/* Breakdown for delivery */}
            {orderType === 'delivery' && !['out_for_delivery', 'ready', 'pending'].includes(status) && transitMinutes != null && (
              <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <ChefHat className="h-4 w-4" />
                  <span>Prep ~{formatRemaining(
                    estimatedReadyAt
                      ? Math.max(0, Math.ceil((new Date(estimatedReadyAt).getTime() - now) / 60_000))
                      : 15
                  )}</span>
                </div>
                <span className="text-border">+</span>
                <div className="flex items-center gap-1.5">
                  <Truck className="h-4 w-4" />
                  <span>Delivery ~{formatRemaining(transitMinutes)}</span>
                </div>
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
