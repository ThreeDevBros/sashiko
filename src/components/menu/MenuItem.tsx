import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Leaf } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import type { MenuItem as MenuItemType, Branding } from '@/types';

interface MenuItemProps {
  item: MenuItemType;
  branding: Branding | null;
  onItemClick: (item: MenuItemType) => void;
  index?: number;
}

export const MenuItem = ({ item, branding, onItemClick, index = 0 }: MenuItemProps) => {
  const currency = branding?.currency || 'USD';

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.01] active:scale-[0.98] active:opacity-90 animate-fade-in rounded-2xl overflow-hidden group bg-card border-border"
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

        {/* Content on Right */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          {/* Item Name */}
          <h3 
            className="text-sm font-bold transition-colors duration-300 group-hover:text-primary line-clamp-1 text-foreground"
            style={{ 
              fontFamily: branding?.font_family || 'inherit'
            }}
          >
            {item.name}
          </h3>

          {/* Description */}
          {item.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {item.description}
            </p>
          )}

          {/* Price */}
          <div className="mt-1">
            <span className="text-lg font-bold text-primary">
              {formatCurrency(Number(item.price), currency)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};
