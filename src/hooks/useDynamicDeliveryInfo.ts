import { useEffect, useState, useRef } from 'react';
import { useBranch } from '@/hooks/useBranch';
import { useDeliveryAddress } from '@/hooks/useDeliveryAddress';
import { useDeliveryFeeConfig } from '@/hooks/useDeliveryFeeConfig';
import { calculateDeliveryFee } from '@/lib/deliveryFee';
import { calculateDistance } from '@/lib/distance';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { formatCurrency } from '@/lib/currency';

interface DynamicDeliveryInfo {
  totalDeliveryMinutes: number | null;
  transitMinutes: number | null;
  deliveryFee: number | null;
  feeLabel: string;
  timeLabel: string;
  loading: boolean;
}

// Module-level cache so results persist across page navigations / remounts
const transitCache = new Map<string, number>();

function buildCacheKey(bLat: number, bLng: number, uLat: number, uLng: number): string {
  // Round to 4 decimals (~11m precision) to avoid near-duplicate calls
  const r = (n: number) => n.toFixed(4);
  return `${r(bLat)},${r(bLng)}-${r(uLat)},${r(uLng)}`;
}

export function useDynamicDeliveryInfo(): DynamicDeliveryInfo {
  const { branch, estimatedTime } = useBranch();
  const { locationData } = useDeliveryAddress();
  const deliveryFeeConfig = useDeliveryFeeConfig();

  const branchLat = branch?.latitude;
  const branchLng = branch?.longitude;
  const userLat = locationData?.latitude;
  const userLng = locationData?.longitude;

  const cacheKey = branchLat && branchLng && userLat && userLng
    ? buildCacheKey(branchLat, branchLng, userLat, userLng)
    : null;

  const cached = cacheKey ? transitCache.get(cacheKey) ?? null : null;

  const [transitMinutes, setTransitMinutes] = useState<number | null>(cached);
  const [loading, setLoading] = useState(false);
  const activeKeyRef = useRef<string | null>(null);

  // Sync from cache on key change (e.g. remount on new page with same coords)
  useEffect(() => {
    if (cacheKey && transitCache.has(cacheKey)) {
      setTransitMinutes(transitCache.get(cacheKey)!);
    }
  }, [cacheKey]);

  // Fetch driving time only if not cached
  useEffect(() => {
    if (!branchLat || !branchLng || !userLat || !userLng || !cacheKey) {
      setTransitMinutes(null);
      activeKeyRef.current = null;
      return;
    }

    // Already cached — skip API call
    if (transitCache.has(cacheKey)) {
      if (activeKeyRef.current !== cacheKey) {
        setTransitMinutes(transitCache.get(cacheKey)!);
        activeKeyRef.current = cacheKey;
      }
      return;
    }

    // Already fetching this key
    if (activeKeyRef.current === cacheKey) return;
    activeKeyRef.current = cacheKey;

    let cancelled = false;
    setLoading(true);

    const fetchTransit = async () => {
      try {
        await loadGoogleMaps(['maps', 'routes']);
        if (cancelled) return;

        const directionsService = new google.maps.DirectionsService();
        directionsService.route(
          {
            origin: { lat: branchLat, lng: branchLng },
            destination: { lat: userLat, lng: userLng },
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (cancelled) return;
            let mins: number;
            if (status === 'OK' && result?.routes[0]?.legs[0]) {
              const durationSec = result.routes[0].legs[0].duration?.value || 0;
              mins = Math.ceil(durationSec / 60);
            } else {
              const distKm = calculateDistance(branchLat, branchLng, userLat, userLng);
              mins = Math.ceil((distKm / 40) * 60);
            }
            transitCache.set(cacheKey, mins);
            setTransitMinutes(mins);
            setLoading(false);
          }
        );
      } catch {
        const distKm = calculateDistance(branchLat, branchLng, userLat, userLng);
        const mins = Math.ceil((distKm / 40) * 60);
        transitCache.set(cacheKey, mins);
        setTransitMinutes(mins);
        setLoading(false);
      }
    };

    fetchTransit();
    return () => { cancelled = true; };
  }, [cacheKey, branchLat, branchLng, userLat, userLng]);

  // Calculate delivery fee from real distance
  const distanceKm = branchLat && branchLng && userLat && userLng
    ? calculateDistance(branchLat, branchLng, userLat, userLng)
    : null;

  const deliveryFee = distanceKm != null && deliveryFeeConfig
    ? calculateDeliveryFee(distanceKm, deliveryFeeConfig)
    : null;

  const totalDeliveryMinutes = transitMinutes != null
    ? estimatedTime + transitMinutes
    : null;

  const timeLabel = totalDeliveryMinutes != null
    ? `${totalDeliveryMinutes}–${totalDeliveryMinutes + 10} min`
    : `${estimatedTime}–${estimatedTime + 10} min`;

  const feeLabel = deliveryFee != null
    ? (deliveryFee === 0 ? 'Free' : formatCurrency(deliveryFee))
    : deliveryFeeConfig
      ? deliveryFeeConfig.free_delivery_threshold
        ? `From ${formatCurrency(deliveryFeeConfig.min_delivery_fee || deliveryFeeConfig.delivery_base_fee)}`
        : formatCurrency(deliveryFeeConfig.delivery_base_fee)
      : '...';

  return {
    totalDeliveryMinutes,
    transitMinutes,
    deliveryFee,
    feeLabel,
    timeLabel,
    loading,
  };
}
