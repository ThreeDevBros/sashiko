import { MapPin, Timer, Bike, Clock, DollarSign, ChevronDown, AlertCircle } from 'lucide-react';
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
  const { timeLabel, feeLabel } = useDynamicDeliveryInfo();

  const TimeIcon = variant === 'hero' ? Timer : Clock;
  const FeeIcon = variant === 'hero' ? Bike : DollarSign;
  const isPaused = branch?.is_paused === true;

  return (
    <div
      onClick={onClick}
      className={`bg-card rounded-2xl p-3 shadow-lg cursor-pointer hover:shadow-xl transition-all border ${isPaused ? 'border-destructive/50 bg-destructive/5' : 'border-border/50'} ${className}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {isPaused ? (
          <AlertCircle className="w-4 h-4 text-destructive" />
        ) : (
          <MapPin className="w-4 h-4 text-primary" />
        )}
        <span className={`font-semibold text-sm ${isPaused ? 'text-destructive' : 'text-foreground'}`}>
          {isPaused
            ? `${branch?.name || 'Branch'} • Busy — Not Accepting Orders`
            : `Delivering from • ${branch?.name || 'Nearest Branch'}`}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
      </div>
      {!isPaused && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <TimeIcon className="w-3.5 h-3.5" />
            <span>{timeLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <FeeIcon className="w-3.5 h-3.5" />
            <span>{feeLabel} delivery</span>
          </div>
        </div>
      )}
    </div>
  );
}
