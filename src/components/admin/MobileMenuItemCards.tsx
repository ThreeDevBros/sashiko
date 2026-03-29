import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, ChevronDown, Tag, DollarSign, UtensilsCrossed } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  is_available?: boolean | null;
  is_featured?: boolean | null;
  image_url?: string | null;
  menu_categories?: { name: string } | null;
  menu_item_modifiers?: { modifier_group_id: string }[] | null;
  disabled_permanently?: boolean | null;
  disabled_until?: string | null;
  [key: string]: any;
}

interface MobileMenuItemCardsProps {
  items: MenuItem[];
  onEdit: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
  getPriceLabel?: (itemId: string, fallbackPrice: number) => string;
}

export const MobileMenuItemCards = ({ items, onEdit, onDelete, getPriceLabel }: MobileMenuItemCardsProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!items?.length) {
    return <p className="text-center text-muted-foreground py-8">No menu items found.</p>;
  }

  const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

  return (
    <div className="space-y-3 p-4">
      {items.map((item) => {
        const isExpanded = expandedId === item.id;

        return (
          <div
            key={item.id}
            className="rounded-lg border border-border/60 bg-card/50 overflow-hidden transition-all"
          >
            {/* Clickable summary */}
            <div
              className="cursor-pointer active:bg-muted/30 transition-colors"
              onClick={() => toggle(item.id)}
            >
              {/* Header: Name + Status */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <UtensilsCrossed className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-semibold text-[15px]">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      item.is_available
                        ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                        : 'bg-red-500/15 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {item.is_available ? 'Available' : 'Unavailable'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </div>

              <div className="border-t border-border/30 mx-5" />

              {/* Category + Price row */}
              <div className="px-5 py-3 flex flex-wrap gap-x-8 gap-y-3">
                <div className="min-w-0">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Category
                  </span>
                  <p className="text-sm mt-1">{item.menu_categories?.name || '—'}</p>
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> Price
                  </span>
                  <p className="text-sm mt-1 font-semibold">{getPriceLabel ? getPriceLabel(item.id, item.price) : `€${Number(item.price).toFixed(2)}`}</p>
                </div>
                {item.is_featured && (
                  <div className="min-w-0">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/15 text-primary border border-primary/30">
                      Featured
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div className="border-t border-border/40">
                <div className="px-5 py-3 space-y-3">
                  {item.description && (
                    <div>
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Description</span>
                      <p className="text-sm mt-1 leading-relaxed">{item.description}</p>
                    </div>
                  )}
                  {item.menu_item_modifiers && item.menu_item_modifiers.length > 0 && (
                    <div>
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Modifier Groups</span>
                      <p className="text-sm mt-1">{item.menu_item_modifiers.length} group{item.menu_item_modifiers.length > 1 ? 's' : ''} assigned</p>
                    </div>
                  )}
                  {(item.disabled_permanently || item.disabled_until) && (
                    <div>
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Availability</span>
                      <p className="text-sm mt-1 text-red-400">
                        {item.disabled_permanently
                          ? 'Permanently disabled'
                          : `Disabled until ${new Date(item.disabled_until!).toLocaleDateString()}`}
                      </p>
                    </div>
                  )}
                  {item.image_url && (
                    <div>
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Image</span>
                      <img src={item.image_url} alt={item.name} className="mt-1 w-20 h-20 rounded-md object-cover" />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border-t border-border/30 mx-5" />

            {/* Actions — always visible */}
            <div className="px-5 py-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="outline" className="h-10 gap-1.5 text-xs px-3" onClick={() => onEdit(item)}>
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
              <Button size="sm" variant="outline" className="h-10 gap-1.5 text-xs px-3 text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={() => onDelete(item)}>
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
