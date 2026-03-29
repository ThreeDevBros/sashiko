import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getSavedBranchId } from '@/lib/branch';
import { useBranch } from '@/hooks/useBranch';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBranding } from '@/hooks/useBranding';
import { formatCurrency } from '@/lib/currency';
import { FloatingBranchWidget } from '@/components/FloatingBranchWidget';
import { SwipeableCartItem } from '@/components/cart/SwipeableCartItem';
import { BackButton } from '@/components/BackButton';
import { MenuItemDetailSheet } from '@/components/menu/MenuItemDetailSheet';
import type { MenuItem } from '@/types';

const Cart = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items, addItem, removeItem, updateQuantity, updateItemNote } = useCart();
  const { toast } = useToast();
  const { branding } = useBranding();
  const { branch } = useBranch();
  const [recommendedItems, setRecommendedItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

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
            category_id
          )
        `)
        .eq('branch_id', savedBranchId)
        .eq('is_available', true)
        .limit(4);

      if (branchMenuItems) {
        setRecommendedItems(branchMenuItems.filter((item: any) => item.menu_items).slice(0, 4));
      }
    };

    fetchRecommendedItems();
  }, []);

  const handleEditItem = async (cartItem: typeof items[0]) => {
    // Fetch the full menu item details
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
      setEditSheetOpen(true);
    }
  };

  const handleUpdateCartItem = (item: MenuItem, quantity: number, modifiers: string[], instructions: string) => {
    // Remove old item and add updated one
    if (editingItem) {
      // Find the cart item being edited by matching editingItem.id
      const editingCartItem = items.find(i => i.id === editingItem.id);
      if (editingCartItem) {
        removeItem(editingCartItem.cartKey);
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
    }
    setEditSheetOpen(false);
    setEditingItem(null);
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
          <Card className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">{t('cart.empty')}</h2>
            <p className="text-muted-foreground mb-6">{t('cart.emptyDesc')}</p>
            <Button onClick={() => navigate('/')}>
              {t('cart.browseMenu')}
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <FloatingBranchWidget />
      
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <BackButton />
          <div className="flex-1 text-center">
            <h1 className="text-xl font-bold text-foreground">{branch?.name || branding?.tenant_name || 'Cart'}</h1>
          </div>
          <div className="w-10" /> {/* Spacer for alignment */}
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Order Items */}
        <div>
          <h2 className="text-2xl font-bold mb-4">{t('cart.orderItems')}</h2>
          
          <div className="space-y-3">
            {items.map((item) => (
              <SwipeableCartItem
                key={item.cartKey}
                item={item}
                currency={branding?.currency}
                onDelete={() => {
                  removeItem(item.cartKey);
                }}
                onEdit={() => handleEditItem(item)}
                onUpdateQuantity={(quantity) => {
                  if (quantity === 0) {
                    removeItem(item.cartKey);
                  } else {
                    updateQuantity(item.cartKey, quantity);
                  }
                }}
                onUpdateNote={(note) => updateItemNote(item.cartKey, note)}
              />
            ))}
          </div>
        </div>

        {/* Checkout Button */}
        <Card className="bg-card shadow-md p-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 px-2">
              <p className="text-xs text-muted-foreground">{t('cart.total')}</p>
              <p className="text-lg font-bold">
                {formatCurrency(
                  items.reduce((sum, item) => sum + item.price * item.quantity, 0),
                  branding?.currency
                )}
              </p>
            </div>
            <Button 
              onClick={() => navigate('/checkout')}
              className="rounded-xl py-3 px-5 text-sm font-semibold gap-1.5"
            >
              {t('cart.checkout')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        {/* Recommended for you */}
        {recommendedItems.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">{t('cart.recommended')}</h2>
            <div className="grid grid-cols-2 gap-4">
              {recommendedItems.map((item: any) => {
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
                        {formatCurrency(price, branding?.currency)}
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

      {/* Edit Item Sheet */}
      <MenuItemDetailSheet
        item={editingItem}
        branding={branding}
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        onAddToCart={handleUpdateCartItem}
        initialSpecialInstructions={editingItem ? items.find(i => i.id === editingItem.id)?.special_instructions || '' : ''}
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
