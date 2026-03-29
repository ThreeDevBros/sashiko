import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Leaf, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { useBranding } from '@/hooks/useBranding';
import type { MenuItem as MenuItemType, MenuCategory } from '@/types';

interface ItemDetailInlineProps {
  item: MenuItemType;
  currency: string;
  branding: any;
}

const ItemDetailInline = ({ item, currency, branding }: ItemDetailInlineProps) => {
  const [expanded, setExpanded] = useState(false);

  const { data: details, isLoading } = useQuery({
    queryKey: ['qr-menu-item-details', item.id],
    queryFn: async () => {
      const [{ data: allergenLinks }, { data: modifierLinks }] = await Promise.all([
        supabase.from('menu_item_allergens').select('allergen_id').eq('menu_item_id', item.id),
        supabase.from('menu_item_modifiers').select('modifier_group_id').eq('menu_item_id', item.id),
      ]);

      let allergens: { id: string; name: string }[] = [];
      if (allergenLinks?.length) {
        const { data } = await supabase.from('allergens').select('id, name').in('id', allergenLinks.map(l => l.allergen_id));
        allergens = data || [];
      }

      let modifierGroups: { id: string; name: string; modifiers: { id: string; name: string; price_adjustment: number }[] }[] = [];
      if (modifierLinks?.length) {
        const { data: groups } = await supabase.from('modifier_groups').select('*').in('id', modifierLinks.map(l => l.modifier_group_id));
        if (groups) {
          modifierGroups = await Promise.all(groups.map(async (g) => {
            const { data: mods } = await supabase.from('modifiers').select('id, name, price_adjustment').eq('group_id', g.id);
            return { id: g.id, name: g.name, modifiers: mods || [] };
          }));
        }
      }

      return { allergens, modifierGroups };
    },
    enabled: expanded,
  });

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all duration-200">
      <div
        className="flex gap-4 p-4 cursor-pointer active:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        {item.image_url && (
          <div className="relative w-32 h-32 md:w-40 md:h-40 flex-shrink-0 rounded-xl overflow-hidden bg-muted">
            <img src={item.image_url} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
            <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
              {item.is_featured && (
                <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5">Featured</Badge>
              )}
              {(item.is_vegetarian || item.is_vegan) && (
                <Badge variant="secondary" className="bg-green-500 text-white text-xs px-1.5 py-0.5">
                  <Leaf className="w-3 h-3 mr-0.5" />
                  {item.is_vegan ? 'Vegan' : 'Veg'}
                </Badge>
              )}
            </div>
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
          <div>
            <h3 className="text-lg md:text-xl font-extrabold text-foreground line-clamp-2" style={{ fontFamily: branding?.font_family || 'inherit' }}>
              {item.name}
            </h3>
            {item.description && (
              <p className="text-sm text-muted-foreground mt-1 break-words whitespace-pre-wrap">{item.description}</p>
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xl md:text-2xl font-bold text-primary">{formatCurrency(Number(item.price), currency)}</span>
            {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border space-y-3 animate-fade-in">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : (
            <>
              {item.calories && (
                <p className="text-xs text-muted-foreground">{item.calories} calories</p>
              )}

              {details?.allergens && details.allergens.length > 0 && (
                <div className="p-3 rounded-xl bg-muted/50 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-foreground" />
                    <span className="text-sm font-semibold text-foreground">Allergens</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {details.allergens.map(a => (
                      <Badge key={a.id} variant="outline" className="text-xs">{a.name}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {details?.modifierGroups && details.modifierGroups.length > 0 && (
                <div className="space-y-2">
                  {details.modifierGroups.map(group => (
                    <div key={group.id} className="p-3 rounded-xl bg-muted/50 border border-border">
                      <span className="text-sm font-semibold text-foreground">{group.name}</span>
                      <div className="mt-2 space-y-1">
                        {group.modifiers.map(mod => (
                          <div key={mod.id} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{mod.name}</span>
                            {mod.price_adjustment > 0 && (
                              <span className="text-muted-foreground">+{formatCurrency(mod.price_adjustment, currency)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!details?.allergens?.length && !details?.modifierGroups?.length && !item.calories && (
                <p className="text-xs text-muted-foreground italic">No additional details available.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const BranchMenu = () => {
  const { branchId } = useParams<{ branchId: string }>();
  const { branding } = useBranding();
  const currency = branding?.currency || 'USD';

  const { data: branch, isLoading: branchLoading } = useQuery({
    queryKey: ['qr-branch', branchId],
    queryFn: async () => {
      const { data, error } = await supabase.from('branches').select('*').eq('id', branchId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });

  const { data: categories } = useQuery<MenuCategory[]>({
    queryKey: ['qr-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('menu_categories').select('*').eq('is_active', true).order('display_order');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: menuItems, isLoading: itemsLoading } = useQuery<MenuItemType[]>({
    queryKey: ['qr-menu-items', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branch_menu_items')
        .select(`*, menu_items (id, name, description, price, image_url, is_featured, is_vegetarian, is_vegan, calories, category_id)`)
        .eq('branch_id', branchId!)
        .eq('is_available', true);
      if (error) throw error;
      return data?.map(item => ({
        ...item.menu_items,
        price: item.price_override || item.menu_items.price,
      })) || [];
    },
    enabled: !!branchId,
  });

  const isLoading = branchLoading || itemsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto p-4 space-y-6">
          <Skeleton className="h-10 w-48 mx-auto" />
          <Skeleton className="h-6 w-32" />
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Menu Not Found</h1>
          <p className="text-muted-foreground">This branch menu is not available.</p>
        </div>
      </div>
    );
  }

  const categoriesWithItems = categories?.filter(cat => menuItems?.some(item => item.category_id === cat.id)) || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center">
          {branding?.logo_url && (
            <img src={branding.logo_url} alt="Logo" className="h-10 mx-auto mb-2 object-contain" />
          )}
          <h1
            className="text-xl font-bold text-foreground"
            style={{ fontFamily: branding?.font_family || 'inherit' }}
          >
            {branch.name}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{branch.address}, {branch.city}</p>
        </div>
      </div>

      {/* Menu */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8 pb-16">
        {categoriesWithItems.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No menu items available at this time.</p>
        ) : (
          categoriesWithItems.map(category => {
            const items = menuItems?.filter(item => item.category_id === category.id) || [];
            return (
              <section key={category.id}>
                <h2
                  className="text-xl font-bold text-foreground mb-3"
                  style={{ fontFamily: branding?.font_family || 'inherit' }}
                >
                  {category.name}
                </h2>
                <div className="space-y-3">
                  {items.map(item => (
                    <ItemDetailInline key={item.id} item={item} currency={currency} branding={branding} />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BranchMenu;
