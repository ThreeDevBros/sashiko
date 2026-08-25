import { useEffect, useMemo, useRef, useState } from 'react';

interface UseOrderEtaArgs {
  orderType: 'delivery' | 'pickup' | 'dine_in';
  status: string;
  estimatedReadyAt: string | null;
  deliveryTransitMinutes?: number | null;
  onRemainingMinutesChange?: (minutes: number | null) => void;
}

/**
 * Single source of truth for the customer-facing ETA.
 * Mirrors the server-side Live Activity formula.
 */
export function useOrderEta({
  orderType,
  status,
  estimatedReadyAt,
  deliveryTransitMinutes,
  onRemainingMinutesChange,
}: UseOrderEtaArgs) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const transitMinutes = deliveryTransitMinutes ?? null;

  const remainingMinutes = useMemo(() => {
    if (['delivered', 'cancelled'].includes(status)) return null;
    if (status === 'pending') return null;
    if (status === 'ready' && orderType !== 'delivery') return 0;

    let prepRemaining = 0;
    if (estimatedReadyAt && !['ready', 'out_for_delivery'].includes(status)) {
      const diffMs = new Date(estimatedReadyAt).getTime() - now;
      prepRemaining = Math.max(0, Math.ceil(diffMs / 60_000));
    }

    if (status === 'out_for_delivery') return transitMinutes ?? 15;
    if (status === 'ready' && orderType === 'delivery') return (transitMinutes ?? 15) + 5;

    if (orderType === 'delivery') return prepRemaining + (transitMinutes ?? 0);
    return prepRemaining > 0 ? prepRemaining : 0;
  }, [status, estimatedReadyAt, now, transitMinutes, orderType]);

  const cbRef = useRef(onRemainingMinutesChange);
  cbRef.current = onRemainingMinutesChange;
  useEffect(() => {
    cbRef.current?.(remainingMinutes);
  }, [remainingMinutes]);

  const prepRemainingMinutes = useMemo(() => {
    if (!estimatedReadyAt) return null;
    return Math.max(0, Math.ceil((new Date(estimatedReadyAt).getTime() - now) / 60_000));
  }, [estimatedReadyAt, now]);

  return { remainingMinutes, transitMinutes, prepRemainingMinutes };
}

export function formatEta(mins: number) {
  if (mins <= 0) return 'Now';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
