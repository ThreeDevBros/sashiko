import { MapPin, Timer, Bike, Clock, DollarSign, ChevronDown, AlertCircle, ShoppingBag } from 'lucide-react';
import { useBranch } from '@/hooks/useBranch';
import { useDynamicDeliveryInfo } from '@/hooks/useDynamicDeliveryInfo';

interface BranchInfoPillProps {
  onClick: () => void;
  className?: string;
  /** Visual variant — 'hero' uses Timer+Bike icons, 'header' uses Clock+DollarSign */
  variant?: 'hero' | 'header';
}

export function BranchInfoPill({ onClick, className = '', variant = 'header' }: BranchInfoPillProps) {
  const { branch } = useBranch();
  const { timeLabel, feeLabel, isOutOfRadius } = useDynamicDeliveryInfo();

  const TimeIcon = variant === 'hero' ? Timer : Clock;
  const FeeIcon = variant === 'hero' ? Bike : DollarSign;
  const isPaused = branch?.is_paused === true;

  const borderClass = isPaused
    ? 'border-destructive/50 bg-destructive/5'
    : isOutOfRadius
      ? 'border-orange-400/50 bg-orange-50 dark:bg-orange-950/20'
      : 'border-border/50';

  return (
    <div
      onClick={onClick}
      className={`bg-card rounded-2xl p-3 shadow-lg cursor-pointer hover:shadow-xl transition-all border ${borderClass} ${className}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {isPaused ? (
          <AlertCircle className="w-4 h-4 text-destructive" />
        ) : isOutOfRadius ? (
          <ShoppingBag className="w-4 h-4 text-orange-500" />
        ) : (
          <MapPin className="w-4 h-4 text-primary" />
        )}
        <span className={`font-semibold text-sm ${isPaused ? 'text-destructive' : isOutOfRadius ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'}`}>
          {isPaused
            ? `${branch?.name || 'Branch'} • Busy — Not Accepting Orders`
            : isOutOfRadius
              ? `${branch?.name || 'Branch'} • Pickup Only`
              : `Delivering from • ${branch?.name || 'Nearest Branch'}`}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
      </div>
      {!isPaused && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <TimeIcon className="w-3.5 h-3.5" />
            <span>{isOutOfRadius ? `Est. pickup ${timeLabel}` : timeLabel}</span>
          </div>
          {!isOutOfRadius && (
            <div className="flex items-center gap-1">
              <FeeIcon className="w-3.5 h-3.5" />
              <span>{feeLabel} delivery</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
