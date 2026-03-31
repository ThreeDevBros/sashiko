import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBranding } from '@/hooks/useBranding';
import { useBranch } from '@/hooks/useBranch';
import { useCart } from '@/contexts/CartContext';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { MenuItem } from '@/components/menu/MenuItem';
import { MenuItemDetailSheet } from '@/components/menu/MenuItemDetailSheet';
import { QUERY_KEYS, ANIMATION_DELAYS } from '@/constants';
import type { MenuItem as MenuItemType, MenuCategory } from '@/types';

export const MenuDisplay = () => {
  const { branding } = useBranding();
  const { branch, loading: branchLoading } = useBranch();
  const { addItem } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItemType | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();


  const handleItemClick = (item: MenuItemType) => {
    setSelectedItem(item);
    setDetailSheetOpen(true);
  };

  const handleAddToCart = (item: MenuItemType, quantity: number, modifiers: string[], specialInstructions: string) => {
    for (let i = 0; i < quantity; i++) {
      addItem({
        id: item.id,
        name: item.name,
        price: Number(item.price),
        image_url: item.image_url,
        special_instructions: specialInstructions || undefined,
        selectedModifiers: modifiers.length > 0 ? modifiers : undefined,
        tax_rate: (item as any).tax_rate ?? null,
        tax_included_in_price: (item as any).tax_included_in_price ?? false,
      });
    }
  };

  const { data: categories, isLoading: categoriesLoading, refetch: refetchCategories } = useQuery<MenuCategory[]>({
    queryKey: [QUERY_KEYS.MENU_CATEGORIES, branch?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: menuItems, isLoading: itemsLoading, refetch: refetchItems } = useQuery<MenuItemType[]>({
    queryKey: [QUERY_KEYS.MENU_ITEMS, branch?.id],
    queryFn: async () => {
      if (!branch?.id) return [];
      
      const { data, error } = await supabase
        .from('branch_menu_items')
        .select(`
          *,
          menu_items (
            id,
            name,
            description,
            price,
            image_url,
            is_featured,
            is_vegetarian,
            is_vegan,
            calories,
            category_id,
            menu_categories (name)
          )
        `)
        .eq('branch_id', branch.id)
        .eq('is_available', true)
        .order('menu_items(name)');
      
      if (error) throw error;
      
      return data?.map(item => ({
        ...item.menu_items,
        price: item.price_override || item.menu_items.price,
        branch_availability: item.is_available
      })) || [];
    },
    enabled: !!branch?.id,
  });

  // Auto-open item from query param (e.g. /order?item=xxx)
  useEffect(() => {
    const itemId = searchParams.get('item');
    if (itemId && menuItems && menuItems.length > 0) {
      const found = menuItems.find(i => i.id === itemId);
      if (found) {
        setSelectedItem(found);
        setDetailSheetOpen(true);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, menuItems, setSearchParams]);

  useEffect(() => {
    const handleBranchChange = () => {
      setIsTransitioning(true);
      setTimeout(() => {
        refetchCategories();
        refetchItems();
      }, ANIMATION_DELAYS.TRANSITION_SHORT);
      setTimeout(() => {
        setIsTransitioning(false);
      }, ANIMATION_DELAYS.TRANSITION_MEDIUM);
    };

    window.addEventListener('branchChanged', handleBranchChange);
    return () => window.removeEventListener('branchChanged', handleBranchChange);
  }, [refetchCategories, refetchItems]);

  // Set initial category
  useEffect(() => {
    if (categories && categories.length > 0 && !selectedCategory) {
      const firstCategoryWithItems = categories.find(cat => {
        const items = menuItems?.filter(item => item.category_id === cat.id);
        return items && items.length > 0;
      });
      if (firstCategoryWithItems) {
        setSelectedCategory(firstCategoryWithItems.id);
      }
    }
  }, [categories, menuItems, selectedCategory]);

  const scrollChipIntoView = useCallback((categoryId: string) => {
    const container = categoryScrollRef.current;
    const chip = container?.querySelector(`[data-category-id="${categoryId}"]`) as HTMLElement | null;
    if (container && chip) {
      const chipLeft = chip.offsetLeft;
      const chipWidth = chip.offsetWidth;
      const containerWidth = container.offsetWidth;
      container.scrollTo({
        left: chipLeft - containerWidth / 2 + chipWidth / 2,
        behavior: 'smooth',
      });
    }
  }, []);

  // Intersection Observer for category highlighting
  useEffect(() => {
    if (!categories || categories.length === 0 || !menuItems || menuItems.length === 0) return;

    const timer = setTimeout(() => {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const categoryId = entry.target.id.replace('category-', '');
              setSelectedCategory(categoryId);
              scrollChipIntoView(categoryId);
            }
          });
        },
        { rootMargin: '-64px 0px -50% 0px', threshold: 0.01 }
      );

      categories.forEach((category) => {
        const element = document.getElementById(`category-${category.id}`);
        if (element && observerRef.current) {
          observerRef.current.observe(element);
        }
      });
    }, 200);

    return () => {
      clearTimeout(timer);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [categories, menuItems, scrollChipIntoView]);

  const scrollToCategory = (categoryId: string) => {
    const element = document.getElementById(`category-${categoryId}`);
    if (element) {
      const stickyBarHeight = 64;
      const elementTop = element.getBoundingClientRect().top + window.scrollY - stickyBarHeight;
      window.scrollTo({ top: elementTop, behavior: 'smooth' });
      setSelectedCategory(categoryId);
      scrollChipIntoView(categoryId);
    }
  };

  const isLoading = categoriesLoading || itemsLoading || branchLoading || isTransitioning;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Sticky skeleton */}
        <div className="fixed left-0 right-0 top-0 md:top-14 z-40 bg-background py-3 border-b border-border">
          <div className="flex gap-2 px-4 overflow-x-auto">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 w-28 bg-muted rounded-full flex-shrink-0 animate-pulse" />
            ))}
          </div>
        </div>
        {/* Items skeleton */}
        <div className="px-4 space-y-8">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-4">
              <div className="h-8 w-40 bg-muted rounded animate-pulse" />
              <div className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-24 bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <div className="px-4">
        <Card className="p-12 text-center">
          <h3 className="text-2xl font-bold mb-4">No Menu Available</h3>
          <p className="text-muted-foreground mb-6">
            There are currently no menu items available.
          </p>
          <Button onClick={() => window.location.href = '/'}>Return Home</Button>
        </Card>
      </div>
    );
  }

  if (!menuItems || menuItems.length === 0) {
    return (
      <div className="px-4">
        <Card className="p-12 text-center">
          <h3 className="text-2xl font-bold mb-4">No Items Available</h3>
          <p className="text-muted-foreground">
            There are currently no menu items available at this branch.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Fixed Category Bar */}
      <div className="sticky top-0 md:top-14 z-40 bg-background border-b border-border shadow-sm">
        <div 
          ref={categoryScrollRef} 
          className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide"
        >
      {categories.map((category, index) => {
            const categoryItems = menuItems.filter(item => item.category_id === category.id);
            if (categoryItems.length === 0) return null;
            const isActive = selectedCategory === category.id;

            return (
              <button
                key={category.id}
                data-category-id={category.id}
                className={`whitespace-nowrap flex-shrink-0 transition-all duration-200 px-4 py-2 rounded-full text-sm font-medium border ${
                  isActive
                    ? 'bg-yellow-500 text-black border-yellow-500 shadow-md font-semibold'
                    : 'bg-transparent text-foreground border-border hover:bg-muted'
                }`}
                onClick={() => {
                  scrollToCategory(category.id);
                }}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Menu Items */}
      <div className="px-4 py-4 space-y-10">
        {categories.map((category) => {
          const categoryItems = menuItems.filter(item => item.category_id === category.id);
          if (categoryItems.length === 0) return null;

          return (
            <section 
              key={category.id} 
              id={`category-${category.id}`} 
              className="scroll-mt-[52px] md:scroll-mt-[68px]"
            >
              <h2 
                className="text-2xl font-bold mb-4 text-foreground"
                style={{ fontFamily: branding?.font_family || 'inherit' }}
              >
                {category.name}
              </h2>

              <div className="space-y-3">
                {categoryItems.map((item, itemIndex) => (
                  <MenuItem
                    key={item.id}
                    item={item}
                    branding={branding}
                    onItemClick={handleItemClick}
                    index={itemIndex}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Item Detail Sheet */}
      <MenuItemDetailSheet
        item={selectedItem}
        branding={branding}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onAddToCart={handleAddToCart}
      />
    </div>
  );
};
