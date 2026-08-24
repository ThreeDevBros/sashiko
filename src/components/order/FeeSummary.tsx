import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/lib/currency';

interface FeeSummaryProps {
  currency?: string;
  subtotal: number;
  serviceFee: number;
  /** Pass null to hide the delivery row (pickup orders). */
  deliveryFee: number | null;
  tax: number;
  total: number;
  /** Kept for backwards compatibility; any zero fee is now rendered as "Free". */
  isFreeDelivery?: boolean;
  /** Shown when the delivery fee is still an estimate (distance unknown). */
  deliveryNote?: string;
  /** Hide the total row when the caller renders its own (e.g. after cashback). */
  showTotal?: boolean;
  className?: string;
}

const isZero = (amount: number) => Math.round(amount * 100) <= 0;

/**
 * Single source of truth for how the money breakdown is rendered, shared by
 * the cart bar and the checkout summary so the two can't drift apart.
 */
export const FeeSummary = ({
  currency,
  subtotal,
  serviceFee,
  deliveryFee,
  tax,
  total,
  isFreeDelivery = false,
  deliveryNote,
  showTotal = true,
  className = '',
}: FeeSummaryProps) => {
  const { t } = useTranslation();

  const FeeValue = ({ amount, forceFree = false }: { amount: number; forceFree?: boolean }) => {
    if (forceFree || isZero(amount)) {
      return <span className="font-medium text-primary">{t('checkout.free')}</span>;
    }
    return <span>{formatCurrency(amount, currency)}</span>;
  };

  const deliveryIsFree = deliveryFee !== null && (isFreeDelivery || isZero(deliveryFee));

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{t('checkout.subtotal')}</span>
        <FeeValue amount={subtotal} />
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{t('checkout.serviceFee')}</span>
        <FeeValue amount={serviceFee} />
      </div>
      {deliveryFee !== null && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {t('checkout.deliveryFee')}
            {deliveryNote && (
              <span className="text-xs text-muted-foreground/70"> · {deliveryNote}</span>
            )}
          </span>
          <FeeValue amount={deliveryFee} forceFree={deliveryIsFree} />
        </div>
      )}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{t('checkout.tax')}</span>
        <FeeValue amount={tax} />
      </div>
      {showTotal && (
        <div className="flex justify-between border-t border-border pt-2 font-bold">
          <span>{t('checkout.grandTotal')}</span>
          <FeeValue amount={total} />
        </div>
      )}
    </div>
  );
};

