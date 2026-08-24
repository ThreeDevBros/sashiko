import { MapPinOff, ArrowRight, ShoppingBag } from 'lucide-react';

interface OutOfRangeNoticeProps {
  distanceKm: number | null;
  radiusKm: number;
  onChangeAddress: () => void;
  onSwitchToPickup: () => void;
}

/**
 * Shown when the chosen delivery address sits outside the branch radius.
 * Delivery stays selectable so the user can fix the address from here.
 */
export const OutOfRangeNotice = ({
  distanceKm,
  radiusKm,
  onChangeAddress,
  onSwitchToPickup,
}: OutOfRangeNoticeProps) => (
  <div className="mt-4 rounded-2xl border border-yellow-500/50 bg-yellow-500/5 p-4">
    <div className="flex items-start gap-3">
      <MapPinOff className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
      <div className="flex-1">
        <p className="font-display text-sm font-semibold text-yellow-700 dark:text-yellow-400">
          Address outside delivery area
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {distanceKm != null
            ? `${distanceKm.toFixed(1)} km away — we deliver up to ${radiusKm} km.`
            : `We deliver up to ${radiusKm} km from this branch.`}{' '}
          Pick a closer address or collect your order instead.
        </p>
      </div>
    </div>

    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
      <button
        type="button"
        onClick={onChangeAddress}
        className="flex flex-1 items-center justify-center gap-2 rounded-full border border-yellow-500/60 px-4 py-2.5 text-sm font-medium text-yellow-700 transition-colors hover:bg-yellow-500/10 dark:text-yellow-400"
      >
        Change address
        <ArrowRight className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onSwitchToPickup}
        className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/5"
      >
        <ShoppingBag className="h-4 w-4" />
        Switch to pickup
      </button>
    </div>
  </div>
);
