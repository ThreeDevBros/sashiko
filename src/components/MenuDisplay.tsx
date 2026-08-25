import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { useBranding } from '@/hooks/useBranding';
import { useBranch } from '@/hooks/useBranch';
import { useCart } from '@/contexts/CartContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { MenuItem } from '@/components/menu/MenuItem';
import { MenuItemDetailSheet } from '@/components/menu/MenuItemDetailSheet';
import { QUERY_KEYS, ANIMATION_DELAYS } from '@/constants';
import { fetchMenuCategories, fetchBranchMenuItems } from '@/lib/menuPrefetch';
import type { MenuItem as MenuItemType, MenuCategory } from '@/types';

export const MenuDisplay = () => {
  const { t } = useTranslation();
  const { branding } = useBranding();
  const { branch, loading: branchLoading } = useBranch();
  const { addItem, items: cartItems, updateQuantity, removeItem } = useCart();
  const haptics = useHaptics();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItemType | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [safeAreaTop, setSafeAreaTop] = useState(0);

  useEffect(() => {
    const measure = () => {
      const div = document.createElement('div');
      div.style.position = 'fixed';
      div.style.paddingTop = 'env(safe-area-inset-top)';
      document.body.appendChild(div);
      const value = parseFloat(window.getComputedStyle(div).paddingTop) || 0;
      document.body.removeChild(div);
      setSafeAreaTop(value);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);


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

  /** Items that have modifier groups must go through the detail sheet. */
  const { data: itemsWithOptions } = useQuery<Set<string>>({
    queryKey: ['menu-items-with-options'],
    queryFn: async () => {
      const { data } = await supabase.from('menu_item_modifiers').select('menu_item_id');
      return new Set((data || []).map((row: any) => row.menu_item_id as string));
    },
    staleTime: 5 * 60 * 1000,
  });

  /** Quantity currently in the cart, keyed by menu item id (all variations). */
  const cartQuantities = useMemo(() => {
    const map = new Map<string, number>();
    cartItems.forEach((line) => {
      map.set(line.id, (map.get(line.id) || 0) + line.quantity);
    });
    return map;
  }, [cartItems]);

  const quickAdd = useCallback(
    (item: MenuItemType) => {
      haptics.light();
      addItem({
        id: item.id,
        name: item.name,
        price: Number(item.price),
        image_url: item.image_url,
        tax_rate: (item as any).tax_rate ?? null,
        tax_included_in_price: (item as any).tax_included_in_price ?? false,
      });
    },
    [addItem, haptics],
  );

  /** Decrement the plain (no options, no note) line for this item. */
  const quickRemove = useCallback(
    (item: MenuItemType) => {
      const plainLine = cartItems.find(
        (line) => line.id === item.id && !line.selectedModifiers?.length && !line.special_instructions,
      );
      if (!plainLine) return;
      haptics.light();
      if (plainLine.quantity <= 1) {
        removeItem(plainLine.cartKey);
      } else {
        updateQuantity(plainLine.cartKey, plainLine.quantity - 1);
      }
    },
    [cartItems, haptics, removeItem, updateQuantity],
  );


  const { data: categories, isLoading: categoriesLoading, refetch: refetchCategories } = useQuery<MenuCategory[]>({
    queryKey: [QUERY_KEYS.MENU_CATEGORIES, branch?.id],
    queryFn: fetchMenuCategories,
    staleTime: 5 * 60 * 1000,
  });

  const { data: menuItems, isLoading: itemsLoading, refetch: refetchItems } = useQuery<MenuItemType[]>({
    queryKey: [QUERY_KEYS.MENU_ITEMS, branch?.id],
    queryFn: () => fetchBranchMenuItems(branch!.id),
    enabled: !!branch?.id,
    staleTime: 5 * 60 * 1000,
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
      const topOffset = 64 + safeAreaTop;
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
        { rootMargin: `-${topOffset}px 0px -50% 0px`, threshold: 0.01 }
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
  }, [categories, menuItems, scrollChipIntoView, safeAreaTop]);

  const scrollToCategory = (categoryId: string) => {
    const element = document.getElementById(`category-${categoryId}`);
    if (element) {
      // scroll-margin-top on the section already accounts for the sticky bar + safe area.
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setSelectedCategory(categoryId);
      scrollChipIntoView(categoryId);
    }
  };

  const isLoading = categoriesLoading || itemsLoading || branchLoading || isTransitioning;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Sticky skeleton */}
        <div
          className="fixed left-0 right-0 md:top-14 z-40 bg-background py-3 border-b border-border"
          style={{ top: 'env(safe-area-inset-top)', paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
        >
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

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const isSearching = normalizedSearch.length > 0;
  const searchResults = isSearching
    ? menuItems.filter(
        (item) =>
          item.name?.toLowerCase().includes(normalizedSearch) ||
          item.description?.toLowerCase().includes(normalizedSearch),
      )
    : [];

  const renderMenuItem = (item: MenuItemType, itemIndex: number) => {
    const hasOptions = itemsWithOptions?.has(item.id) ?? false;
    return (
      <MenuItem
        key={item.id}
        item={item}
        branding={branding}
        onItemClick={handleItemClick}
        index={itemIndex}
        cartQuantity={cartQuantities.get(item.id) || 0}
        onQuickAdd={hasOptions ? undefined : quickAdd}
        onQuickRemove={hasOptions ? undefined : quickRemove}
      />
    );
  };

  return (
    <div className="relative">
      {/* Opaque strip covering the top safe area so content never shows above the sticky bar */}
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-40 bg-background pointer-events-none"
        style={{ height: 'env(safe-area-inset-top)' }}
      />

      {/* Sticky Category Bar + Search */}
      <div
        className="sticky md:top-14 z-40 bg-background border-b border-border shadow-sm"
        style={{ top: 'env(safe-area-inset-top)' }}
      >
        <div className="relative flex items-center px-4 py-2 min-h-[3.25rem]">
          {/* Category chips — slide out of the way when search opens */}
          <div
            ref={categoryScrollRef}
            className={`flex gap-2 overflow-x-auto scrollbar-hide flex-1 pr-12 transition-all duration-300 ease-out ${
              searchOpen ? 'opacity-0 -translate-x-8 pointer-events-none' : 'opacity-100 translate-x-0'
            }`}
          >
            {categories.map((category, index) => {
              const categoryItems = menuItems.filter(item => item.category_id === category.id);
              if (categoryItems.length === 0) return null;
              const isActive = selectedCategory === category.id;

              return (
                <button
                  key={category.id}
                  data-category-id={category.id}
                  className={`whitespace-nowrap flex-shrink-0 transition-all duration-200 h-9 px-4 rounded-full text-sm font-medium border ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary shadow-md font-semibold'
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

          {/* Search — expands sideways from the circular button into a full-width field */}
          <div
            className={`absolute top-2 right-4 flex items-center gap-2 transition-all duration-300 ease-out ${
              searchOpen ? 'left-4' : 'left-auto w-9'
            }`}
          >
            <div className="relative flex-1 min-w-0 overflow-hidden">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />

              <Input
                ref={searchInputRef}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('menu.searchPlaceholder')}
                enterKeyHint="search"
                tabIndex={searchOpen ? 0 : -1}
                className={`pl-9 rounded-full h-9 w-full transition-opacity duration-200 focus-visible:ring-0 focus-visible:ring-offset-0 ${
                  searchOpen ? 'opacity-100 delay-100' : 'opacity-0 pointer-events-none'
                }`}
              />
            </div>
            <button
              type="button"
              aria-label={searchOpen ? t('common.close') : t('menu.searchPlaceholder')}
              onClick={() => {
                if (searchOpen) {
                  setSearchTerm('');
                  setSearchOpen(false);
                } else {
                  setSearchOpen(true);
                  setTimeout(() => searchInputRef.current?.focus(), 220);
                }
              }}
              className="h-9 w-9 flex-shrink-0 rounded-full border border-border bg-background flex items-center justify-center text-foreground hover:bg-muted transition-colors"
            >
              {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>


      {/* Search results */}
      {isSearching ? (
        <div className="px-4 py-4">
          {searchResults.length === 0 ? (
            <Card className="p-10 text-center">
              <h3 className="text-lg font-bold mb-2">{t('menu.noResults')}</h3>
              <p className="text-muted-foreground text-sm mb-5">{t('menu.noResultsDesc')}</p>
              <Button variant="outline" onClick={() => setSearchTerm('')}>
                {t('menu.clearSearch')}
              </Button>
            </Card>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}
              </p>
              <div className="space-y-3">
                {searchResults.map((item, itemIndex) => renderMenuItem(item, itemIndex))}
              </div>
            </>
          )}
        </div>
      ) : (
        /* Menu Items */
        <div className="px-4 py-4 space-y-10">
          {categories.map((category) => {
            const categoryItems = menuItems.filter(item => item.category_id === category.id);
            if (categoryItems.length === 0) return null;

            return (
              <section
                key={category.id}
                id={`category-${category.id}`}
                className="scroll-mt-[calc(env(safe-area-inset-top)+64px)] md:scroll-mt-[68px]"
              >
                <h2
                  className="text-2xl font-bold mb-4 text-foreground"
                  style={{ fontFamily: branding?.font_family || 'inherit' }}
                >
                  {category.name}
                </h2>

                <div className="space-y-3">
                  {categoryItems.map((item, itemIndex) => renderMenuItem(item, itemIndex))}
                </div>
              </section>
            );
          })}
        </div>
      )}


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
