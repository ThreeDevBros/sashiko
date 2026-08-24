import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useBranding } from '@/hooks/useBranding';
import { formatCurrency } from '@/lib/currency';

/**
 * Always-visible running total while browsing the menu, so the cart never
 * disappears from view. Sits above the bottom navigation.
 */
export const StickyCartBar = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { itemCount, total } = useCart();
  const { branding } = useBranding();

  if (itemCount === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-[4.5rem] z-40 px-4 pointer-events-none">
      <button
        type="button"
        onClick={() => navigate('/cart')}
        className="pointer-events-auto w-full max-w-2xl mx-auto flex items-center gap-3 rounded-2xl bg-primary text-primary-foreground px-4 py-3 shadow-lg active:scale-[0.98] transition-transform animate-in slide-in-from-bottom-4 fade-in duration-300"
      >
        <span className="relative flex-shrink-0">
          <ShoppingBag className="h-5 w-5" />
          <span className="absolute -top-2 -right-2 min-w-4 h-4 px-1 rounded-full bg-background text-foreground text-[10px] font-bold flex items-center justify-center">
            {itemCount}
          </span>
        </span>
        <span className="flex-1 text-left text-sm font-semibold">
          {t('cart.viewOrder')}
        </span>
        <span className="text-sm font-bold">{formatCurrency(total, branding?.currency)}</span>
        <ChevronRight className="h-4 w-4 flex-shrink-0" />
      </button>
    </div>
  );
};
