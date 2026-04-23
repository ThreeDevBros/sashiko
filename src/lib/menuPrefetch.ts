import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS } from '@/constants';
import type { MenuCategory, MenuItem as MenuItemType } from '@/types';

const STALE_TIME = 5 * 60 * 1000;

export const fetchMenuCategories = async (): Promise<MenuCategory[]> => {
  const { data, error } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('is_active', true)
    .order('display_order');
  if (error) throw error;
  return data || [];
};

export const fetchBranchMenuItems = async (branchId: string): Promise<MenuItemType[]> => {
  if (!branchId) return [];
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
    .eq('branch_id', branchId)
    .eq('is_available', true)
    .order('menu_items(name)');

  if (error) throw error;

  return (data?.map((item: any) => ({
    ...item.menu_items,
    price: item.price_override || item.menu_items.price,
    branch_availability: item.is_available,
  })) || []) as MenuItemType[];
};

export const prefetchMenuForBranch = (qc: QueryClient, branchId: string) => {
  if (!branchId) return;
  void qc.prefetchQuery({
    queryKey: [QUERY_KEYS.MENU_CATEGORIES, branchId],
    queryFn: fetchMenuCategories,
    staleTime: STALE_TIME,
  });
  void qc.prefetchQuery({
    queryKey: [QUERY_KEYS.MENU_ITEMS, branchId],
    queryFn: () => fetchBranchMenuItems(branchId),
    staleTime: STALE_TIME,
  });
};
