import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Clock, Truck, ChefHat } from 'lucide-react';
import { loadGoogleMaps } from '@/lib/googleMaps';

interface DeliveryTimeEstimateProps {
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

export function DeliveryTimeEstimate({
  orderType,
  status,
  estimatedReadyAt,
  branchLat,
  branchLng,
  deliveryLat,
  deliveryLng,
  guestDeliveryLat,
  guestDeliveryLng,
}: DeliveryTimeEstimateProps) {
  const [transitMinutes, setTransitMinutes] = useState<number | null>(null);
  const [transitText, setTransitText] = useState<string>('');
  const [prepRemainingMinutes, setPrepRemainingMinutes] = useState<number | null>(null);

  // Calculate prep time remaining
  useEffect(() => {
    if (!estimatedReadyAt) {
      // For pickup orders without an estimated_ready_at, use a default prep estimate
      if (orderType === 'pickup' && !['delivered', 'cancelled', 'ready'].includes(status)) {
        setPrepRemainingMinutes(status === 'pending' ? 20 : 15);
      } else {
        setPrepRemainingMinutes(null);
      }
      return;
    }

    const update = () => {
      const now = new Date();
      const readyAt = new Date(estimatedReadyAt);
      const diffMs = readyAt.getTime() - now.getTime();
      const diffMins = Math.max(0, Math.ceil(diffMs / 60000));
      setPrepRemainingMinutes(diffMins);
    };

    update();
    const interval = setInterval(update, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [estimatedReadyAt]);

  // Calculate delivery transit time via Google Directions
  useEffect(() => {
    if (orderType !== 'delivery') return;
    if (!branchLat || !branchLng) return;

    const destLat = deliveryLat || guestDeliveryLat;
    const destLng = deliveryLng || guestDeliveryLng;
    if (!destLat || !destLng) return;

    let cancelled = false;

    const fetchTransitTime = async () => {
      try {
        await loadGoogleMaps(['maps', 'routes']);
        if (cancelled) return;

        const directionsService = new google.maps.DirectionsService();
        directionsService.route(
          {
            origin: { lat: branchLat, lng: branchLng },
            destination: { lat: destLat, lng: destLng },
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, routeStatus) => {
            if (cancelled) return;
            if (routeStatus === 'OK' && result?.routes[0]?.legs[0]) {
              const leg = result.routes[0].legs[0];
              const durationSec = leg.duration?.value || 0;
              const durationMin = Math.ceil(durationSec / 60);
              setTransitMinutes(durationMin);
              setTransitText(leg.duration?.text || '');
            }
          }
        );
      } catch (err) {
        console.error('Failed to get transit time:', err);
      }
    };

    fetchTransitTime();
    return () => { cancelled = true; };
  }, [orderType, branchLat, branchLng, deliveryLat, deliveryLng, guestDeliveryLat, guestDeliveryLng]);

  // Don't show for completed/cancelled orders
  if (['delivered', 'cancelled'].includes(status)) return null;

  // Before confirmation, show "Waiting for Confirmation" for both delivery and pickup
  if (status === 'pending') {
    const estimateLabel = orderType === 'pickup' ? 'Estimated pickup time' : 'Estimated delivery';
    return (
      <Card className="overflow-hidden">
        <div className="bg-primary/10 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/20 rounded-full">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{estimateLabel}</p>
                <p className="text-2xl font-bold text-foreground">Waiting for Confirmation</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Don't show if we have no time info at all
  if (prepRemainingMinutes === null && transitMinutes === null) return null;

  // Calculate total estimated time
  const getTotalEstimate = (): { minutes: number; label: string } | null => {
    if (status === 'out_for_delivery') {
      // Food is already on the way, show only transit time
      if (transitMinutes !== null) {
        return { minutes: transitMinutes, label: 'Estimated delivery' };
      }
      return null;
    }

    if (status === 'ready') {
      // Food is ready, waiting for driver
      if (orderType === 'delivery' && transitMinutes !== null) {
        return { minutes: transitMinutes + 5, label: 'Estimated delivery' }; // +5 for driver pickup
      }
      if (orderType === 'pickup') {
        return { minutes: 0, label: 'Ready now!' };
      }
      return null;
    }

    // Preparing, confirmed, or pending
    const prep = prepRemainingMinutes ?? 0;

    if (orderType === 'delivery' && transitMinutes !== null) {
      return { minutes: prep + transitMinutes, label: 'Estimated delivery' };
    }

    if (orderType === 'pickup' && prep > 0) {
      return { minutes: prep, label: 'Estimated pickup time' };
    }

    if (prep > 0) {
      return { minutes: prep, label: 'Estimated ready' };
    }

    return null;
  };

  const estimate = getTotalEstimate();
  if (!estimate) return null;

  const formatTime = (mins: number) => {
    if (mins === 0) return 'Now';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  return (
    <Card className="overflow-hidden">
      <div className="bg-primary/10 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/20 rounded-full">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{estimate.label}</p>
              <p className="text-2xl font-bold text-foreground">
                {estimate.minutes === 0 ? 'Ready now!' : `~${formatTime(estimate.minutes)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        {orderType === 'delivery' && prepRemainingMinutes !== null && prepRemainingMinutes > 0 && transitMinutes !== null && status !== 'out_for_delivery' && (
          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <ChefHat className="h-4 w-4" />
              <span>Prep: ~{formatTime(prepRemainingMinutes)}</span>
            </div>
            <span className="text-border">+</span>
            <div className="flex items-center gap-1.5">
              <Truck className="h-4 w-4" />
              <span>Delivery: ~{transitText || formatTime(transitMinutes)}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
