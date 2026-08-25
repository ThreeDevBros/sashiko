import { formatEta } from '@/hooks/useOrderEta';
import { cn } from '@/lib/utils';

interface TrackingStatusHeroProps {
  status: string;
  orderType: 'delivery' | 'pickup' | 'dine_in';
  remainingMinutes: number | null;
  prepRemainingMinutes: number | null;
  transitMinutes: number | null;
}

const DELIVERY_STEPS = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
const PICKUP_STEPS = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];

const HEADLINES: Record<string, string> = {
  pending: 'Sending to kitchen',
  confirmed: 'Order accepted',
  preparing: 'Being prepared',
  ready: 'Ready',
  out_for_delivery: 'On the way',
  delivered: 'Delivered',
};

export function TrackingStatusHero({
  status,
  orderType,
  remainingMinutes,
  prepRemainingMinutes,
  transitMinutes,
}: TrackingStatusHeroProps) {
  const steps = orderType === 'delivery' ? DELIVERY_STEPS : PICKUP_STEPS;
  const currentIndex = Math.max(0, steps.indexOf(status));
  const isDone = status === 'delivered';
  const isDelivery = orderType === 'delivery';

  const headline = isDone
    ? isDelivery ? 'Delivered' : 'Picked up'
    : HEADLINES[status] ?? 'Tracking order';

  let subline: string;
  if (isDone) {
    subline = 'Enjoy your meal';
  } else if (status === 'pending') {
    subline = 'Waiting for the restaurant to confirm';
  } else if (remainingMinutes == null) {
    subline = 'Calculating time…';
  } else if (remainingMinutes === 0) {
    subline = isDelivery ? 'Arriving any moment' : 'Ready to collect now';
  } else {
    subline = `${isDelivery ? 'Arriving in' : 'Ready in'} ~${formatEta(remainingMinutes)}`;
  }

  const showBreakdown =
    isDelivery &&
    !isDone &&
    !['pending', 'ready', 'out_for_delivery'].includes(status) &&
    prepRemainingMinutes != null &&
    transitMinutes != null;

  return (
    <div className="rounded-[26px] border border-border/60 bg-card/85 backdrop-blur-2xl p-5 shadow-[0_18px_50px_-20px_hsl(var(--foreground)/0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-2xl font-semibold leading-tight text-foreground truncate">
            {headline}
          </h2>
          <p className={cn('text-sm font-medium mt-0.5', isDone ? 'text-muted-foreground' : 'text-primary')}>
            {subline}
          </p>
        </div>
        {!isDone && (
          <span className="shrink-0 flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Live
            </span>
          </span>
        )}
      </div>

      {/* Segmented progress rail */}
      <div className="mt-4 flex gap-1.5">
        {steps.map((step, i) => (
          <span
            key={step}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-500',
              i < currentIndex && 'bg-primary',
              i === currentIndex && 'bg-primary animate-pulse',
              i > currentIndex && 'bg-muted-foreground/25'
            )}
          />
        ))}
      </div>

      {showBreakdown && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>Prep ~{formatEta(prepRemainingMinutes!)}</span>
          <span className="text-muted-foreground/40">+</span>
          <span>Drive ~{formatEta(transitMinutes!)}</span>
        </div>
      )}
    </div>
  );
}
