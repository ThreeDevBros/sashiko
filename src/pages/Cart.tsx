import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getSavedBranchId } from '@/lib/branch';
import { useBranch } from '@/hooks/useBranch';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, ChevronRight, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart, type CartItem as CartLine } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { useBranding } from '@/hooks/useBranding';
import { useDeliveryFeeConfig } from '@/hooks/useDeliveryFeeConfig';
import { formatCurrency } from '@/lib/currency';
import { computeItemTotals } from '@/lib/orderTotals';
import { FeeSummary } from '@/components/order/FeeSummary';
import { FloatingBranchWidget } from '@/components/FloatingBranchWidget';
import { SwipeableCartItem } from '@/components/cart/SwipeableCartItem';
import { BackButton } from '@/components/BackButton';
import { MenuItemDetailSheet } from '@/components/menu/MenuItemDetailSheet';
import type { MenuItem } from '@/types';

const Cart = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items, addItem, removeItem, updateQuantity, updateItemNote } = useCart();
  const { branding } = useBranding();
  const { branch } = useBranch();
  const deliveryFeeConfig = useDeliveryFeeConfig();
  const [recommendedItems, setRecommendedItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCartKey, setEditingCartKey] = useState<string | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [unavailableIds, setUnavailableIds] = useState<string[]>([]);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const currency = branding?.currency;

  // Fetch recommended items
  useEffect(() => {
    const fetchRecommendedItems = async () => {
      const savedBranchId = getSavedBranchId();
      if (!savedBranchId) return;

      const { data: branchMenuItems } = await supabase
        .from('branch_menu_items')
        .select(`
          *,
          menu_items (
            id,
            name,
            price,
            image_url,
            is_featured,
            description,
            is_vegetarian,
            is_vegan,
            calories,
            category_id,
            tax_rate,
            tax_included_in_price
          )
        `)
        .eq('branch_id', savedBranchId)
        .eq('is_available', true)
        .limit(8);

      if (branchMenuItems) {
        setRecommendedItems(branchMenuItems.filter((item: any) => item.menu_items));
      }
    };

    fetchRecommendedItems();
  }, []);

  /**
   * Flag cart lines that are no longer sold at this branch, so the problem
   * surfaces here rather than at payment time.
   */
  useEffect(() => {
    const verifyAvailability = async () => {
      const branchId = getSavedBranchId();
      if (!branchId || items.length === 0) {
        setUnavailableIds([]);
        return;
      }
      const ids = Array.from(new Set(items.map((i) => i.id)));
      const { data, error } = await supabase
        .from('branch_menu_items')
        .select('menu_item_id, is_available')
        .eq('branch_id', branchId)
        .in('menu_item_id', ids);

      if (error || !data) return;
      const available = new Set(
        data.filter((row: any) => row.is_available).map((row: any) => row.menu_item_id as string),
      );
      setUnavailableIds(ids.filter((id) => !available.has(id)));
    };

    verifyAvailability();
  }, [items]);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Totals — identical math to checkout so the numbers never disagree
  const globalTaxRate = (branding as any)?.vat_rate ?? 10;
  const serviceFeeRate = (branding as any)?.service_fee_rate ?? 5;
  const { subtotal, tax } = useMemo(
    () => computeItemTotals(items, globalTaxRate),
    [items, globalTaxRate],
  );
  const serviceFee = subtotal * (serviceFeeRate / 100);
  const estimatedDeliveryFee = deliveryFeeConfig
    ? deliveryFeeConfig.free_delivery_threshold != null &&
      subtotal >= deliveryFeeConfig.free_delivery_threshold
      ? 0
      : deliveryFeeConfig.delivery_base_fee
    : null;
  const isFreeDelivery =
    estimatedDeliveryFee === 0 && deliveryFeeConfig?.free_delivery_threshold != null;
  const estimatedTotal = subtotal + serviceFee + tax + (estimatedDeliveryFee ?? 0);

  const restoreLine = useCallback(
    (line: CartLine) => {
      for (let i = 0; i < line.quantity; i++) {
        addItem({
          id: line.id,
          name: line.name,
          price: line.price,
          image_url: line.image_url,
          special_instructions: line.special_instructions,
          selectedModifiers: line.selectedModifiers,
          tax_rate: line.tax_rate ?? null,
          tax_included_in_price: line.tax_included_in_price ?? false,
        });
      }
    },
    [addItem],
  );

  const handleDeleteLine = (line: CartLine) => {
    removeItem(line.cartKey);
  };

  const handleEditItem = async (cartItem: CartLine) => {
    const { data: menuItem } = await supabase
      .from('menu_items')
      .select('*')
      .eq('id', cartItem.id)
      .single();

    if (menuItem) {
      setEditingItem({
        ...menuItem,
        price: cartItem.price, // Use cart price in case of overrides
      } as MenuItem);
      // Track the exact line being edited — matching by item id would clobber
      // a second line of the same dish with different options.
      setEditingCartKey(cartItem.cartKey);
      setEditSheetOpen(true);
    }
  };

  const handleUpdateCartItem = (item: MenuItem, quantity: number, modifiers: string[], instructions: string) => {
    if (editingCartKey) {
      removeItem(editingCartKey);
    }
    for (let i = 0; i < quantity; i++) {
      addItem({
        id: item.id,
        name: item.name,
        price: Number(item.price),
        image_url: item.image_url,
        special_instructions: instructions || undefined,
        selectedModifiers: modifiers.length > 0 ? modifiers : undefined,
        tax_rate: (item as any).tax_rate ?? null,
        tax_included_in_price: (item as any).tax_included_in_price ?? false,
      });
    }
    setEditSheetOpen(false);
    setEditingItem(null);
    setEditingCartKey(null);
  };

  const handleRecommendedItemClick = (menuItem: any, price: number) => {
    setSelectedItem({
      ...menuItem,
      price: price,
    } as MenuItem);
    setDetailSheetOpen(true);
  };

  const handleAddRecommendedItem = (item: MenuItem, quantity: number, modifiers: string[], instructions: string) => {
    for (let i = 0; i < quantity; i++) {
      addItem({
        id: item.id,
        name: item.name,
        price: Number(item.price),
        image_url: item.image_url,
        special_instructions: instructions || undefined,
        selectedModifiers: modifiers.length > 0 ? modifiers : undefined,
        tax_rate: (item as any).tax_rate ?? null,
        tax_included_in_price: (item as any).tax_included_in_price ?? false,
      });
    }
    setDetailSheetOpen(false);
    setSelectedItem(null);
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <FloatingBranchWidget />
        <div className="container max-w-2xl mx-auto px-4 py-8">
          <BackButton />
          <Card className="p-8 text-center mt-4">
            <h2 className="text-2xl font-bold mb-4">{t('cart.empty')}</h2>
            <p className="text-muted-foreground mb-6">{t('cart.emptyDesc')}</p>
            <Button onClick={() => navigate('/order')}>
              {t('cart.browseMenu')}
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // Don't suggest what's already in the cart
  const cartItemIds = new Set(items.map((i) => i.id));
  const suggestions = recommendedItems
    .filter((row: any) => !cartItemIds.has(row.menu_items.id))
    .slice(0, 4);

  const hasUnavailable = unavailableIds.length > 0;

  return (
    <div className="min-h-screen bg-background pb-28">
      <FloatingBranchWidget />

      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-10 pt-safe">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <BackButton />
          <div className="flex-1 text-center">
            <h1 className="text-xl font-bold text-foreground">{branch?.name || branding?.tenant_name || 'Cart'}</h1>
            <p className="text-xs text-muted-foreground">
              {itemCount} {itemCount === 1 ? t('cart.item') : t('cart.items')}
            </p>
          </div>
          <div className="w-10" /> {/* Spacer for alignment */}
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Unavailable warning */}
        {hasUnavailable && (
          <Card className="p-4 border-destructive/40 bg-destructive/5">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-sm text-destructive">{t('cart.unavailableTitle')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('cart.unavailableDesc')}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    items
                      .filter((line) => unavailableIds.includes(line.id))
                      .forEach((line) => removeItem(line.cartKey));
                  }}
                >
                  {t('cart.remove')}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Order Items */}
        <div>
          <h2 className="text-2xl font-bold mb-4">{t('cart.orderItems')}</h2>

          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.cartKey}
                className={unavailableIds.includes(item.id) ? 'opacity-60 ring-1 ring-destructive rounded-2xl' : ''}
              >
                <SwipeableCartItem
                  item={item}
                  currency={currency}
                  onDelete={() => handleDeleteLine(item)}
                  onEdit={() => handleEditItem(item)}
                  onUpdateQuantity={(quantity) => {
                    if (quantity === 0) {
                      handleDeleteLine(item);
                    } else {
                      updateQuantity(item.cartKey, quantity);
                    }
                  }}
                  onUpdateNote={(note) => updateItemNote(item.cartKey, note)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Recommended for you */}
        {suggestions.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">{t('cart.recommended')}</h2>
            <div className="grid grid-cols-2 gap-4">
              {suggestions.map((item: any) => {
                const menuItem = item.menu_items;
                const price = item.price_override || menuItem.price;

                return (
                  <Card key={item.id} className="overflow-hidden">
                    <div className="relative aspect-video bg-muted">
                      {menuItem.image_url ? (
                        <img
                          src={menuItem.image_url}
                          alt={menuItem.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          {t('common.noImage')}
                        </div>
                      )}
                      <Button
                        size="icon"
                        className="absolute top-2 right-2 rounded-full bg-primary hover:bg-primary/90"
                        onClick={() => handleRecommendedItemClick(menuItem, price)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="p-3">
                      <p className="text-primary font-semibold mb-1">
                        {formatCurrency(price, currency)}
                      </p>
                      <h3 className="font-medium text-sm line-clamp-2">{menuItem.name}</h3>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sticky summary + checkout */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-md pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
        <div className="container max-w-2xl mx-auto px-4 pt-3 pb-5 space-y-3">
          {breakdownOpen && (
            <FeeSummary
              currency={currency}
              subtotal={subtotal}
              serviceFee={serviceFee}
              deliveryFee={estimatedDeliveryFee}
              tax={tax}
              total={estimatedTotal}
              isFreeDelivery={isFreeDelivery}
              deliveryNote={t('checkout.estimated')}
              className="animate-in fade-in slide-in-from-bottom-2 duration-200"
            />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setBreakdownOpen((v) => !v)}
              className="flex-1 text-left px-1"
            >
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {t('cart.total')}
                {breakdownOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
              </p>
              <p className="text-lg font-bold">{formatCurrency(estimatedTotal, currency)}</p>
            </button>
            <Button
              onClick={() => navigate('/checkout')}
              disabled={hasUnavailable}
              className="rounded-xl py-3 px-5 text-sm font-semibold gap-1.5"
            >
              {t('cart.checkout')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Item Sheet */}
      <MenuItemDetailSheet
        item={editingItem}
        branding={branding}
        open={editSheetOpen}
        onOpenChange={(open) => {
          setEditSheetOpen(open);
          if (!open) setEditingCartKey(null);
        }}
        onAddToCart={handleUpdateCartItem}
        initialSpecialInstructions={
          editingCartKey ? items.find(i => i.cartKey === editingCartKey)?.special_instructions || '' : ''
        }
      />

      {/* Recommended Item Detail Sheet */}
      <MenuItemDetailSheet
        item={selectedItem}
        branding={branding}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onAddToCart={handleAddRecommendedItem}
      />
    </div>
  );
};

export default Cart;
