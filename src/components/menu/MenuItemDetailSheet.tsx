import { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Minus, Plus, Leaf, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { supabase } from '@/integrations/supabase/client';
import { useKeyboardAwareScroll } from '@/hooks/useKeyboardAwareScroll';
import type { MenuItem as MenuItemType, Branding } from '@/types';

interface ModifierGroup {
  id: string;
  name: string;
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  modifiers: {
    id: string;
    name: string;
    price_adjustment: number;
  }[];
}

interface Allergen {
  id: string;
  name: string;
  description: string | null;
}

interface MenuItemDetailSheetProps {
  item: MenuItemType | null;
  branding: Branding | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart: (item: MenuItemType, quantity: number, modifiers: string[], specialInstructions: string) => void;
  initialSpecialInstructions?: string;
}

export const MenuItemDetailSheet = ({
  item,
  branding,
  open,
  onOpenChange,
  onAddToCart,
  initialSpecialInstructions,
}: MenuItemDetailSheetProps) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [loading, setLoading] = useState(false);
  const { wrapperRef, ref: textareaRef, onFocus: handleTextareaFocus, onBlur: handleTextareaBlur } = useKeyboardAwareScroll<HTMLTextAreaElement>();

  const currency = branding?.currency || 'USD';

  useEffect(() => {
    if (item && open) {
      setQuantity(1);
      setSelectedModifiers({});
      setSpecialInstructions(initialSpecialInstructions || '');
      fetchItemDetails();
    }
  }, [item?.id, open]);

  const fetchItemDetails = async () => {
    if (!item) return;
    setLoading(true);

    try {
      // Fetch modifier groups for this item
      const { data: modifierLinks } = await supabase
        .from('menu_item_modifiers')
        .select('modifier_group_id')
        .eq('menu_item_id', item.id);

      if (modifierLinks && modifierLinks.length > 0) {
        const groupIds = modifierLinks.map(link => link.modifier_group_id);
        
        const { data: groups } = await supabase
          .from('modifier_groups')
          .select('*')
          .in('id', groupIds);

        if (groups) {
          const groupsWithModifiers = await Promise.all(
            groups.map(async (group) => {
              const { data: modifiers } = await supabase
                .from('modifiers')
                .select('*')
                .eq('group_id', group.id);
              
              return {
                ...group,
                modifiers: modifiers || [],
              };
            })
          );
          setModifierGroups(groupsWithModifiers);
        }
      } else {
        setModifierGroups([]);
      }

      // Fetch allergens for this item
      const { data: allergenLinks } = await supabase
        .from('menu_item_allergens')
        .select('allergen_id')
        .eq('menu_item_id', item.id);

      if (allergenLinks && allergenLinks.length > 0) {
        const allergenIds = allergenLinks.map(link => link.allergen_id);
        
        const { data: allergenData } = await supabase
          .from('allergens')
          .select('*')
          .in('id', allergenIds);

        setAllergens(allergenData || []);
      } else {
        setAllergens([]);
      }
    } catch (error) {
      console.error('Error fetching item details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModifierChange = (groupId: string, modifierId: string, maxSelections: number) => {
    setSelectedModifiers(prev => {
      const current = prev[groupId] || [];
      
      if (maxSelections === 1) {
        // Radio behavior
        return { ...prev, [groupId]: [modifierId] };
      } else {
        // Checkbox behavior
        if (current.includes(modifierId)) {
          return { ...prev, [groupId]: current.filter(id => id !== modifierId) };
        } else if (current.length < maxSelections) {
          return { ...prev, [groupId]: [...current, modifierId] };
        }
        return prev;
      }
    });
  };

  const calculateTotalPrice = () => {
    if (!item) return 0;
    
    let total = Number(item.price);
    
    // Add modifier prices
    Object.entries(selectedModifiers).forEach(([groupId, modifierIds]) => {
      const group = modifierGroups.find(g => g.id === groupId);
      if (group) {
        modifierIds.forEach(modId => {
          const modifier = group.modifiers.find(m => m.id === modId);
          if (modifier) {
            total += Number(modifier.price_adjustment);
          }
        });
      }
    });
    
    return total * quantity;
  };

  const canAddToCart = () => {
    // Check all required modifiers are selected
    for (const group of modifierGroups) {
      if (group.is_required || group.min_selections > 0) {
        const selected = selectedModifiers[group.id] || [];
        if (selected.length < (group.min_selections || 1)) {
          return false;
        }
      }
    }
    return true;
  };

  const getModifierPriceAdjustment = () => {
    let adjustment = 0;
    Object.entries(selectedModifiers).forEach(([groupId, modifierIds]) => {
      const group = modifierGroups.find(g => g.id === groupId);
      if (group) {
        modifierIds.forEach(modId => {
          const modifier = group.modifiers.find(m => m.id === modId);
          if (modifier) {
            adjustment += Number(modifier.price_adjustment);
          }
        });
      }
    });
    return adjustment;
  };

  const handleAddToCart = () => {
    if (!item || !canAddToCart()) return;
    
    const allSelectedModifiers = Object.values(selectedModifiers).flat();
    const unitPriceWithModifiers = Number(item.price) + getModifierPriceAdjustment();
    const itemWithModifierPrice = { ...item, price: unitPriceWithModifiers };
    onAddToCart(itemWithModifierPrice, quantity, allSelectedModifiers, specialInstructions);
    onOpenChange(false);
  };

  if (!item) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[90vh] rounded-t-3xl">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{item.name}</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-32">
          {/* Item Card - like order page */}
          <div className="flex gap-4 p-4 bg-card rounded-2xl border border-border mb-4">
            {/* Square Thumbnail */}
            {item.image_url && (
              <div className="w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden">
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            {/* Item Details */}
            <div className="flex-1 min-w-0">
              <h2 
                className="text-lg font-bold text-foreground leading-tight"
                style={{ fontFamily: branding?.font_family || 'inherit' }}
              >
                {item.name}
              </h2>
              
              {item.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
              )}
              
              <span className="text-lg font-bold text-primary mt-2 block">
                {formatCurrency(Number(item.price), currency)}
              </span>
            </div>
          </div>

          {/* Loading Skeleton */}
          {loading ? (
            <div className="space-y-4">
              {/* Badges Skeleton */}
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>

              {/* Allergens Skeleton */}
              <div className="p-4 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-14 rounded-full" />
                  <Skeleton className="h-6 w-18 rounded-full" />
                </div>
              </div>

              {/* Modifier Groups Skeleton */}
              <div className="p-4 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                      <Skeleton className="h-4 w-12" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Another Modifier Group Skeleton */}
              <div className="p-4 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <Skeleton className="h-5 w-20" />
                </div>
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <Skeleton className="h-4 w-10" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Special Instructions Skeleton */}
              <div>
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-16 w-full rounded-md" />
              </div>
            </div>
          ) : (
            /* Badges & Details */
            <div className="space-y-4">
              {/* Badges */}
              {(item.is_featured || item.is_vegan || item.is_vegetarian) && (
                <div className="flex flex-wrap gap-2">
                  {item.is_featured && (
                    <Badge className="bg-primary text-primary-foreground">Featured</Badge>
                  )}
                  {item.is_vegan && (
                    <Badge variant="secondary" className="bg-green-500 text-white">
                      <Leaf className="w-3 h-3 mr-1" />
                      Vegan
                    </Badge>
                  )}
                  {item.is_vegetarian && !item.is_vegan && (
                    <Badge variant="secondary" className="bg-green-500 text-white">
                      <Leaf className="w-3 h-3 mr-1" />
                      Vegetarian
                    </Badge>
                  )}
                </div>
              )}

              {/* Allergens */}
              {allergens.length > 0 && (
                <div className="p-4 rounded-xl bg-muted/50 border border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-foreground" />
                    <span className="font-semibold text-foreground">Allergens</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allergens.map(allergen => (
                      <Badge key={allergen.id} variant="outline" className="border-border text-foreground">
                        {allergen.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Modifier Groups */}
              {modifierGroups.length > 0 && (
                <div className="space-y-4">
                  {modifierGroups.map(group => (
                    <div key={group.id} className="p-4 rounded-xl bg-muted/50 border border-border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-foreground">{group.name}</span>
                        {group.is_required && (
                          <Badge variant="outline" className="text-xs">Required</Badge>
                        )}
                      </div>
                      
                      {group.max_selections === 1 ? (
                        <RadioGroup
                          value={selectedModifiers[group.id]?.[0] || ''}
                          onValueChange={(value) => handleModifierChange(group.id, value, 1)}
                        >
                          {group.modifiers.map(modifier => (
                            <div key={modifier.id} className="flex items-center justify-between py-2">
                              <div className="flex items-center gap-3">
                                <RadioGroupItem value={modifier.id} id={modifier.id} />
                                <Label htmlFor={modifier.id} className="cursor-pointer">
                                  {modifier.name}
                                </Label>
                              </div>
                              {modifier.price_adjustment > 0 && (
                                <span className="text-sm text-muted-foreground">
                                  +{formatCurrency(modifier.price_adjustment, currency)}
                                </span>
                              )}
                            </div>
                          ))}
                        </RadioGroup>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground mb-2">
                            Select up to {group.max_selections}
                          </p>
                          {group.modifiers.map(modifier => (
                            <div key={modifier.id} className="flex items-center justify-between py-2">
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  id={modifier.id}
                                  checked={selectedModifiers[group.id]?.includes(modifier.id) || false}
                                  onCheckedChange={() => handleModifierChange(group.id, modifier.id, group.max_selections || 99)}
                                />
                                <Label htmlFor={modifier.id} className="cursor-pointer">
                                  {modifier.name}
                                </Label>
                              </div>
                              {modifier.price_adjustment > 0 && (
                                <span className="text-sm text-muted-foreground">
                                  +{formatCurrency(modifier.price_adjustment, currency)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Special Instructions */}
              <div ref={wrapperRef}>
                <Label htmlFor="special-instructions" className="text-sm font-medium">
                  Special Instructions
                </Label>
                <Textarea
                  id="special-instructions"
                  ref={textareaRef}
                  placeholder="Any special requests? (e.g., no onions, extra spicy)"
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  onFocus={handleTextareaFocus}
                  onBlur={handleTextareaBlur}
                  className="mt-2 resize-none"
                  rows={2}
                  data-vaul-no-drag
                />
              </div>
            </div>
          )}

          {/* Fixed Bottom Bar */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border safe-area-bottom">
            <div className="flex items-center gap-4">
              {/* Quantity Selector */}
              <div className="flex items-center gap-3 bg-muted rounded-full p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="w-6 text-center font-semibold">{quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Add to Cart Button */}
              <Button
                className="flex-1 h-12 text-base font-semibold"
                onClick={handleAddToCart}
                disabled={loading || !canAddToCart()}
              >
                {loading ? 'Loading...' : `Add to Cart · ${formatCurrency(calculateTotalPrice(), currency)}`}
              </Button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
