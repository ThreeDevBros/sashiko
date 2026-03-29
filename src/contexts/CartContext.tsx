import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CartItem {
  id: string;           // menu_item_id (for backend/payment)
  cartKey: string;      // unique key per variation (id + modifiers + instructions)
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
  special_instructions?: string;
  selectedModifiers?: string[];  // modifier IDs
  tax_rate?: number | null;
  tax_included_in_price?: boolean;
}

/** Build a stable unique key for a cart line based on item id, modifiers and instructions */
function buildCartKey(id: string, modifiers?: string[], instructions?: string): string {
  const modKey = modifiers?.length ? [...modifiers].sort().join(',') : '';
  const insKey = (instructions || '').trim();
  return `${id}|${modKey}|${insKey}`;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity' | 'cartKey'> & { selectedModifiers?: string[]; special_instructions?: string }) => void;
  removeItem: (cartKey: string) => void;
  updateQuantity: (cartKey: string, quantity: number) => void;
  updateItemNote: (cartKey: string, note: string) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('cart');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved) as CartItem[];
      // Migrate old items that don't have cartKey
      return parsed.map(item => ({
        ...item,
        cartKey: item.cartKey || buildCartKey(item.id, item.selectedModifiers, item.special_instructions),
      }));
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  // Clear cart on logout
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setItems([]);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Clear cart on branch change
  useEffect(() => {
    const handleBranchChanged = () => {
      setItems([]);
    };
    window.addEventListener('branchChanged', handleBranchChanged);
    return () => window.removeEventListener('branchChanged', handleBranchChanged);
  }, []);

  const addItem = (item: Omit<CartItem, 'quantity' | 'cartKey'> & { selectedModifiers?: string[]; special_instructions?: string }) => {
    const cartKey = buildCartKey(item.id, item.selectedModifiers, item.special_instructions);
    setItems(prev => {
      const existing = prev.find(i => i.cartKey === cartKey);
      if (existing) {
        return prev.map(i =>
          i.cartKey === cartKey
            ? { ...i, quantity: i.quantity + 1, tax_rate: item.tax_rate, tax_included_in_price: item.tax_included_in_price }
            : i
        );
      }
      return [...prev, { ...item, cartKey, quantity: 1 }];
    });
  };

  const removeItem = (cartKey: string) => {
    setItems(prev => prev.filter(i => i.cartKey !== cartKey));
  };

  const updateQuantity = (cartKey: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(cartKey);
      return;
    }
    setItems(prev =>
      prev.map(i => (i.cartKey === cartKey ? { ...i, quantity } : i))
    );
  };

  const updateItemNote = (cartKey: string, note: string) => {
    setItems(prev => {
      // When note changes, the cartKey should change too
      return prev.map(i => {
        if (i.cartKey !== cartKey) return i;
        const newCartKey = buildCartKey(i.id, i.selectedModifiers, note);
        return { ...i, special_instructions: note || undefined, cartKey: newCartKey };
      });
    });
  };

  const clearCart = () => {
    setItems([]);
  };

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, updateItemNote, clearCart, total, itemCount }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};
