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
  /** Renders the delivery row as "Free delivery" instead of a 0 amount. */
  isFreeDelivery?: boolean;
  /** Shown when the delivery fee is still an estimate (distance unknown). */
  deliveryNote?: string;
  className?: string;
}

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
  className = '',
}: FeeSummaryProps) => {
  const { t } = useTranslation();

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{t('checkout.subtotal')}</span>
        <span>{formatCurrency(subtotal, currency)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{t('checkout.serviceFee')}</span>
        <span>{formatCurrency(serviceFee, currency)}</span>
      </div>
      {deliveryFee !== null && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {t('checkout.deliveryFee')}
            {deliveryNote && (
              <span className="text-xs text-muted-foreground/70"> · {deliveryNote}</span>
            )}
          </span>
          <span className={isFreeDelivery ? 'font-medium text-primary' : ''}>
            {isFreeDelivery ? t('checkout.freeDelivery') : formatCurrency(deliveryFee, currency)}
          </span>
        </div>
      )}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{t('checkout.tax')}</span>
        <span>{formatCurrency(tax, currency)}</span>
      </div>
      <div className="flex justify-between border-t border-border pt-2 font-bold">
        <span>{t('checkout.grandTotal')}</span>
        <span>{formatCurrency(total, currency)}</span>
      </div>
    </div>
  );
};
