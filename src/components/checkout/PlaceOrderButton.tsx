import { Loader2, Lock } from 'lucide-react';
import { ApplePayIcon, GooglePayIcon } from '@/components/icons/PaymentIcons';
import { cn } from '@/lib/utils';

type Variant = 'cash' | 'card' | 'applePay' | 'googlePay';

interface PlaceOrderButtonProps {
  variant: Variant;
  /** Kept for compatibility; no longer displayed on the button. */
  amountLabel?: string;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  /** When set, replaces the normal label (e.g. "Branch Closed"). */
  blockedLabel?: string | null;
  actionLabel: string;
  onClick: () => void;
  className?: string;
}

/**
 * Single primary CTA for checkout.
 * - Apple Pay / Google Pay selected → native-style wallet button (mark + "Pay").
 * - Card / cash → centered brand CTA without a price amount.
 */
export const PlaceOrderButton = ({
  variant,
  loading = false,
  loadingLabel = 'Processing…',
  disabled = false,
  blockedLabel = null,
  actionLabel,
  onClick,
  className,
}: PlaceOrderButtonProps) => {
  const isWallet = variant === 'applePay' || variant === 'googlePay';
  const isBlocked = !!blockedLabel;

  const base = cn(
    'w-full h-16 rounded-2xl font-semibold tracking-tight',
    'flex items-center justify-center gap-2 px-5',
    'transition-all duration-200 select-none touch-manipulation',
    'active:scale-[0.985] disabled:active:scale-100',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'animate-in fade-in duration-300',
    className,
  );


  if (loading) {
    return (
      <button type="button" disabled className={cn(base, 'bg-primary text-primary-foreground')}>
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-base">{loadingLabel}</span>
      </button>
    );
  }

  if (isBlocked) {
    return (
      <button type="button" disabled className={cn(base, 'bg-muted text-muted-foreground border border-border')}>
        <span className="text-sm">{blockedLabel}</span>
      </button>
    );
  }

  if (isWallet) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={variant === 'applePay' ? 'Pay with Apple Pay' : 'Pay with Google Pay'}
        className={cn(base, 'bg-foreground text-background shadow-sm')}
      >
        {variant === 'applePay' ? (
          <>
            <ApplePayIcon className="h-6 w-6" />
            <span className="text-[17px] font-semibold">Pay</span>
          </>
        ) : (
          <>
            <GooglePayIcon className="h-5 w-5" />
            <span className="text-[17px] font-semibold">Pay</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        base,
        'bg-primary text-primary-foreground shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.7)]',
        'hover:brightness-[1.06]',
      )}
    >
      {variant === 'card' ? <Lock className="h-4 w-4 opacity-80" /> : null}
      <span className="text-base">{actionLabel}</span>
    </button>
  );
};

export default PlaceOrderButton;

