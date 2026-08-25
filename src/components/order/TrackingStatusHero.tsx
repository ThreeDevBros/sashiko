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
    subline = status === 'ready'
      ? (isDelivery ? 'Waiting for the driver' : 'Ready to collect now')
      : (isDelivery ? 'Arriving any moment' : 'Almost ready');
  } else {
    subline = `${isDelivery ? 'Arriving in' : 'Ready in'} ${formatEta(remainingMinutes)}`;
  }

  return (
    <div className="rounded-[26px] border border-border/60 bg-card/85 backdrop-blur-2xl p-5 shadow-[0_18px_50px_-20px_hsl(var(--foreground)/0.35)]">
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-2xl font-semibold leading-tight text-foreground truncate">
            {headline}
          </h2>
          <p className={cn('text-sm font-medium mt-0.5', isDone ? 'text-muted-foreground' : 'text-primary')}>
            {subline}
          </p>
        </div>
      </div>

      {/* Segmented progress rail */}
      <div className="mt-4 flex gap-1.5">
        {steps.map((step, i) => (
          <span
            key={step}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-500',
              i < currentIndex && 'bg-primary',
              i === currentIndex && ((isDone || status === 'cancelled') ? 'bg-primary' : 'bg-primary animate-[trackingPulse_6s_ease-in-out_infinite]'),
              i > currentIndex && 'bg-muted-foreground/25'
            )}
          />
        ))}
      </div>
    </div>
  );
}
