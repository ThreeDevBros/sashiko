import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Leaf, Plus, Minus } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import type { MenuItem as MenuItemType, Branding } from '@/types';

interface MenuItemProps {
  item: MenuItemType;
  branding: Branding | null;
  onItemClick: (item: MenuItemType) => void;
  index?: number;
  /** Total quantity of this item currently in the cart (all variations). */
  cartQuantity?: number;
  /** Add one straight to the cart (only for items without options). */
  onQuickAdd?: (item: MenuItemType) => void;
  /** Remove one from the cart. Absent when the item has customisations. */
  onQuickRemove?: (item: MenuItemType) => void;
}

export const MenuItem = ({
  item,
  branding,
  onItemClick,
  index = 0,
  cartQuantity = 0,
  onQuickAdd,
  onQuickRemove,
}: MenuItemProps) => {
  const currency = branding?.currency || 'USD';
  const inCart = cartQuantity > 0;

  return (
    <Card
      className={`cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.01] active:scale-[0.98] active:opacity-90 animate-fade-in rounded-2xl overflow-hidden group bg-card ${
        inCart ? 'border-2 border-primary/60' : 'border-border'
      }`}
      onClick={() => onItemClick(item)}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex gap-3 p-3">
        {/* Image on Left */}
        {item.image_url && (
          <div className="relative w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-muted">
            <img
              src={item.image_url}
              alt={item.name}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            {/* Badges */}
            <div className="absolute top-1 left-1 flex flex-col gap-1">
              {item.is_featured && (
                <Badge className="bg-primary text-primary-foreground shadow-lg text-[10px] px-1 py-0">
                  Featured
                </Badge>
              )}
              {(item.is_vegetarian || item.is_vegan) && (
                <Badge variant="secondary" className="bg-green-500 text-white shadow-lg text-[10px] px-1 py-0">
                  <Leaf className="w-2 h-2 mr-0.5" />
                  {item.is_vegan ? 'Vegan' : 'Veg'}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <h3
            className="text-sm font-bold transition-colors duration-300 group-hover:text-primary line-clamp-1 text-foreground"
            style={{ fontFamily: branding?.font_family || 'inherit' }}
          >
            {item.name}
          </h3>

          {item.description && (
            <p className="text-[11px] leading-snug text-muted-foreground line-clamp-3 mt-0.5">
              {item.description}
            </p>
          )}

          <div className="mt-1 flex items-end justify-between gap-2">
            <span className="text-lg font-bold text-primary">
              {formatCurrency(Number(item.price), currency)}
            </span>

            {/* Quick add / stepper — stops the card's detail sheet from opening */}
            {onQuickAdd && (
              <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                {inCart && onQuickRemove ? (
                  <div className="flex items-center gap-1 rounded-full border border-primary bg-primary/10 p-0.5">
                    <button
                      type="button"
                      aria-label="Remove one"
                      onClick={() => onQuickRemove(item)}
                      className="h-7 w-7 rounded-full flex items-center justify-center text-primary active:scale-90 transition-transform"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-4 text-center text-sm font-bold text-primary">
                      {cartQuantity}
                    </span>
                    <button
                      type="button"
                      aria-label="Add one"
                      onClick={() => onQuickAdd(item)}
                      className="h-7 w-7 rounded-full flex items-center justify-center bg-primary text-primary-foreground active:scale-90 transition-transform"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-label={`Add ${item.name} to cart`}
                    onClick={() => onQuickAdd(item)}
                    className="h-9 w-9 rounded-full flex items-center justify-center bg-primary text-primary-foreground shadow-md active:scale-90 transition-transform"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            {/* Items with options: show cart count, tap opens the sheet */}
            {!onQuickAdd && inCart && (
              <Badge className="bg-primary text-primary-foreground flex-shrink-0">
                {cartQuantity} in cart
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
