import { useEffect, useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Clock, ChefHat, Truck, CheckCircle2, Timer } from 'lucide-react';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { motion, AnimatePresence } from 'framer-motion';

interface LiveOrderCountdownProps {
  orderType: 'delivery' | 'pickup' | 'dine_in';
  status: string;
  estimatedReadyAt: string | null;
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
  branchLat,
  branchLng,
  deliveryLat,
  deliveryLng,
  guestDeliveryLat,
  guestDeliveryLng,
}: LiveOrderCountdownProps) {
  const [now, setNow] = useState(Date.now());
  const [transitMinutes, setTransitMinutes] = useState<number | null>(null);

  // Tick every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Fetch transit time for delivery orders
  useEffect(() => {
    if (orderType !== 'delivery') return;
    if (!branchLat || !branchLng) return;
    const destLat = deliveryLat || guestDeliveryLat;
    const destLng = deliveryLng || guestDeliveryLng;
    if (!destLat || !destLng) return;

    let cancelled = false;

    const fetch = async () => {
      try {
        await loadGoogleMaps(['maps', 'routes']);
        if (cancelled) return;
        const svc = new google.maps.DirectionsService();
        svc.route(
          {
            origin: { lat: branchLat, lng: branchLng },
            destination: { lat: destLat, lng: destLng },
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, routeStatus) => {
            if (cancelled) return;
            if (routeStatus === 'OK' && result?.routes[0]?.legs[0]) {
              setTransitMinutes(Math.ceil((result.routes[0].legs[0].duration?.value || 0) / 60));
            }
          }
        );
      } catch {}
    };
    fetch();
    return () => { cancelled = true; };
  }, [orderType, branchLat, branchLng, deliveryLat, deliveryLng, guestDeliveryLat, guestDeliveryLng]);

  // Calculate remaining minutes
  const remainingMinutes = useMemo(() => {
    if (['delivered', 'cancelled'].includes(status)) return null;

    if (status === 'pending') return null; // unknown until confirmed

    if (status === 'ready' && orderType === 'pickup') return 0;

    // Prep remaining
    let prepRemaining = 0;
    if (estimatedReadyAt && !['ready', 'out_for_delivery'].includes(status)) {
      const diffMs = new Date(estimatedReadyAt).getTime() - now;
      prepRemaining = Math.max(0, Math.ceil(diffMs / 60_000));
    } else if (!estimatedReadyAt && !['ready', 'out_for_delivery'].includes(status)) {
      prepRemaining = status === 'confirmed' ? 20 : 15;
    }

    if (status === 'out_for_delivery') {
      return transitMinutes ?? null;
    }

    if (status === 'ready' && orderType === 'delivery') {
      return transitMinutes != null ? transitMinutes + 5 : null;
    }

    if (orderType === 'delivery' && transitMinutes != null) {
      return prepRemaining + transitMinutes;
    }

    return prepRemaining > 0 ? prepRemaining : null;
  }, [status, estimatedReadyAt, now, transitMinutes, orderType]);

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
                    Calculating…
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
