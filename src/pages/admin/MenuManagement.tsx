import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState, useMemo } from 'react';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { UnsavedChangesDialog } from '@/components/admin/UnsavedChangesDialog';
import { Plus, Pencil, Trash2, Calendar, Search } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { ModifierManagement } from '@/components/admin/ModifierManagement';
import { CategoryManagement } from '@/components/admin/CategoryManagement';
import { GenerateMenuImages } from '@/components/admin/GenerateMenuImages';
import { AllergenManagement } from '@/components/admin/AllergenManagement';
import { useIsMobile } from '@/hooks/use-mobile';
import { Checkbox } from '@/components/ui/checkbox';
import { MobileMenuItemCards } from '@/components/admin/MobileMenuItemCards';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export default function MenuManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const isDirty = openDialog !== null;
  const { showDialog, confirmLeave, cancelLeave } = useUnsavedChangesWarning(isDirty);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModifierGroups, setSelectedModifierGroups] = useState<string[]>([]);
  const [itemModifiers, setItemModifiers] = useState<string[]>([]);
  const [filterBranches, setFilterBranches] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [branchPrices, setBranchPrices] = useState<Record<string, string>>({});
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [masterPrice, setMasterPrice] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [modifierSearch, setModifierSearch] = useState('');
  const [showBranchSearch, setShowBranchSearch] = useState(false);
  const [showModifierSearch, setShowModifierSearch] = useState(false);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);

  const { data: tenantVatRate } = useQuery({
    queryKey: ['tenant-vat-rate'],
    queryFn: async () => {
      const { data } = await supabase.from('tenant_settings').select('vat_rate').maybeSingle();
      return (data as any)?.vat_rate ?? 10;
    },
  });

  const { data: branches } = useQuery({
    queryKey: ['branches-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['menu-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_categories')
        .select('*')
        .order('display_order');
      if (error) throw error;
      return data;
    },
  });

  const { data: modifierGroups } = useQuery({
    queryKey: ['modifier-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modifier_groups')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: allergens } = useQuery({
    queryKey: ['allergens'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('allergens')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: menuItems } = useQuery({
    queryKey: ['menu-items-with-branches', filterBranches],
    queryFn: async () => {
      let query = supabase
        .from('menu_items')
        .select(`
          *,
          menu_categories(name),
          menu_item_modifiers(modifier_group_id)
        `);

      // If filtering by specific branches, join with branch_menu_items
      if (filterBranches.length > 0) {
        const { data: branchItems, error: branchError } = await supabase
          .from('branch_menu_items')
          .select('menu_item_id')
          .in('branch_id', filterBranches);
        
        if (branchError) throw branchError;
        
        const itemIds = branchItems?.map(bi => bi.menu_item_id) || [];
        query = query.in('id', itemIds.length > 0 ? itemIds : ['00000000-0000-0000-0000-000000000000']);
      }

      const { data, error } = await query.order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch all branch_menu_items for price range display
  const { data: allBranchMenuItems } = useQuery({
    queryKey: ['all-branch-menu-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branch_menu_items')
        .select('menu_item_id, price_override');
      if (error) throw error;
      return data;
    },
  });

  // Build price range map: itemId -> { min, max }
  const priceRangeMap = useMemo(() => {
    const map: Record<string, { min: number; max: number }> = {};
    if (!allBranchMenuItems) return map;
    for (const bmi of allBranchMenuItems) {
      const price = bmi.price_override != null ? Number(bmi.price_override) : null;
      if (price == null || price <= 0) continue;
      if (!map[bmi.menu_item_id]) {
        map[bmi.menu_item_id] = { min: price, max: price };
      } else {
        map[bmi.menu_item_id].min = Math.min(map[bmi.menu_item_id].min, price);
        map[bmi.menu_item_id].max = Math.max(map[bmi.menu_item_id].max, price);
      }
    }
    return map;
  }, [allBranchMenuItems]);

  const getPriceLabel = (itemId: string, fallbackPrice: number): string => {
    const range = priceRangeMap[itemId];
    if (!range) return formatCurrency(fallbackPrice);
    if (range.min === range.max) return formatCurrency(range.min);
    return `${formatCurrency(range.min)} – ${formatCurrency(range.max)}`;
  };

  const createCategoryMutation = useMutation({
    mutationFn: async (formData: any) => {
      const { error } = await supabase
        .from('menu_categories')
        .insert([formData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
      toast({ title: 'Category created successfully' });
      setOpenDialog(null);
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async ({ itemData, modifierGroupIds, branchIds, branchPriceOverrides, allergenIds }: { 
      itemData: any; 
      modifierGroupIds: string[]; 
      branchIds: string[];
      branchPriceOverrides: Record<string, string>;
      allergenIds: string[];
    }) => {
      const { data: newItem, error: itemError } = await supabase
        .from('menu_items')
        .insert([itemData])
        .select()
        .single();
      
      if (itemError) throw itemError;

      // Add modifier groups
      if (modifierGroupIds.length > 0) {
        const modifierLinks = modifierGroupIds.map(groupId => ({
          menu_item_id: newItem.id,
          modifier_group_id: groupId,
        }));

        const { error: modError } = await supabase
          .from('menu_item_modifiers')
          .insert(modifierLinks);
        
        if (modError) throw modError;
      }

      // Add branch assignments with price overrides
      if (branchIds.length > 0) {
        const branchLinks = branchIds.map(branchId => ({
          menu_item_id: newItem.id,
          branch_id: branchId,
          is_available: true,
          price_override: branchPriceOverrides[branchId] ? parseFloat(branchPriceOverrides[branchId]) : null,
        }));

        const { error: branchError } = await supabase
          .from('branch_menu_items')
          .insert(branchLinks);
        
        if (branchError) throw branchError;
      }

      // Add allergen associations
      if (allergenIds.length > 0) {
        const allergenLinks = allergenIds.map(allergenId => ({
          menu_item_id: newItem.id,
          allergen_id: allergenId,
        }));

        const { error: allergenError } = await supabase
          .from('menu_item_allergens')
          .insert(allergenLinks);
        
        if (allergenError) throw allergenError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items-with-branches'] });
      toast({ title: 'Menu item created successfully' });
      setOpenDialog(null);
      setSelectedModifierGroups([]);
      setSelectedBranches([]);
      setBranchPrices({});
      setSelectedAllergens([]);
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, itemData, modifierGroupIds, branchIds, branchPriceOverrides, allergenIds }: { 
      id: string; 
      itemData: any; 
      modifierGroupIds: string[]; 
      branchIds: string[];
      branchPriceOverrides: Record<string, string>;
      allergenIds: string[];
    }) => {
      const { error: updateError } = await supabase
        .from('menu_items')
        .update(itemData)
        .eq('id', id);
      
      if (updateError) throw updateError;

      // Remove existing modifier links
      const { error: deleteModError } = await supabase
        .from('menu_item_modifiers')
        .delete()
        .eq('menu_item_id', id);
      
      if (deleteModError) throw deleteModError;

      // Add new modifier links
      if (modifierGroupIds.length > 0) {
        const modifierLinks = modifierGroupIds.map(groupId => ({
          menu_item_id: id,
          modifier_group_id: groupId,
        }));

        const { error: insertError } = await supabase
          .from('menu_item_modifiers')
          .insert(modifierLinks);
        
        if (insertError) throw insertError;
      }

      // Remove existing branch links
      const { error: deleteBranchError } = await supabase
        .from('branch_menu_items')
        .delete()
        .eq('menu_item_id', id);
      
      if (deleteBranchError) throw deleteBranchError;

      // Add new branch links with price overrides
      if (branchIds.length > 0) {
        const branchLinks = branchIds.map(branchId => ({
          menu_item_id: id,
          branch_id: branchId,
          is_available: true,
          price_override: branchPriceOverrides[branchId] ? parseFloat(branchPriceOverrides[branchId]) : null,
        }));

        const { error: branchError } = await supabase
          .from('branch_menu_items')
          .insert(branchLinks);
        
        if (branchError) throw branchError;
      }

      // Remove existing allergen links
      const { error: deleteAllergenError } = await supabase
        .from('menu_item_allergens')
        .delete()
        .eq('menu_item_id', id);
      
      if (deleteAllergenError) throw deleteAllergenError;

      // Add new allergen links
      if (allergenIds.length > 0) {
        const allergenLinks = allergenIds.map(allergenId => ({
          menu_item_id: id,
          allergen_id: allergenId,
        }));

        const { error: allergenError } = await supabase
          .from('menu_item_allergens')
          .insert(allergenLinks);
        
        if (allergenError) throw allergenError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items-with-branches'] });
      toast({ title: 'Menu item updated successfully' });
      setEditingItem(null);
      setOpenDialog(null);
      setSelectedModifierGroups([]);
      setSelectedBranches([]);
      setBranchPrices({});
      setSelectedAllergens([]);
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items-with-branches'] });
      toast({ title: 'Menu item deleted successfully' });
    },
  });

  const handleSubmitItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    let disabledUntil = null;
    const disableOption = formData.get('disable_option');
    if (disableOption === '1day') {
      disabledUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    } else if (disableOption === '1week') {
      disabledUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (disableOption === 'custom' && formData.get('custom_disabled_until')) {
      disabledUntil = new Date(formData.get('custom_disabled_until') as string).toISOString();
    }

    const taxRateRaw = formData.get('tax_rate') as string;
    const itemData = {
      name: formData.get('name'),
      description: formData.get('description'),
      price: parseFloat(formData.get('price') as string) || 0,
      category_id: formData.get('category_id'),
      image_url: uploadedImageUrl || formData.get('image_url') || null,
      is_available: true,
      is_featured: formData.get('is_featured') === 'on',
      disabled_until: disabledUntil,
      disabled_permanently: formData.get('disabled_permanently') === 'on',
      tax_rate: taxRateRaw !== '' ? parseFloat(taxRateRaw) : null,
      tax_included_in_price: formData.get('tax_included_in_price') === 'on',
    };

    if (editingItem) {
      updateItemMutation.mutate({ 
        id: editingItem.id, 
        itemData, 
        modifierGroupIds: selectedModifierGroups,
        branchIds: selectedBranches,
        branchPriceOverrides: branchPrices,
        allergenIds: selectedAllergens
      });
    } else {
      createItemMutation.mutate({ 
        itemData, 
        modifierGroupIds: selectedModifierGroups,
        branchIds: selectedBranches,
        branchPriceOverrides: branchPrices,
        allergenIds: selectedAllergens
      });
    }
    setUploadedImageUrl('');
  };

  const filteredMenuItems = menuItems?.filter(item => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = (
      item.name?.toLowerCase().includes(searchLower) ||
      item.description?.toLowerCase().includes(searchLower) ||
      item.menu_categories?.name?.toLowerCase().includes(searchLower)
    );
    
    const matchesCategory = filterCategories.length === 0 || filterCategories.includes(item.category_id);
    
    return matchesSearch && matchesCategory;
  });

  return (
    <>
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6 overflow-x-hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Menu Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage your restaurant menu and categories</p>
        </div>

        <Tabs defaultValue="items" className="space-y-4">
          <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:grid-cols-4 gap-1">
            <TabsTrigger value="items" className="text-sm px-4 py-2">Menu Items</TabsTrigger>
            <TabsTrigger value="categories" className="text-sm px-4 py-2">Categories</TabsTrigger>
            <TabsTrigger value="modifiers" className="text-sm px-4 py-2">Modifiers</TabsTrigger>
            <TabsTrigger value="allergens" className="text-sm px-4 py-2">Allergens</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="space-y-4">
            <GenerateMenuImages />
            
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 items-stretch sm:items-center">
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-[200px] justify-start bg-background text-xs sm:text-sm">
                      {filterBranches.length === 0 
                        ? 'Filter by branches' 
                        : `${filterBranches.length} branch${filterBranches.length > 1 ? 'es' : ''} selected`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[250px] p-3 bg-background border-border z-50" align="start">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center mb-2">
                        <Label className="font-semibold">Branches</Label>
                        {filterBranches.length > 0 && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setFilterBranches([])}
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                      {branches?.map((branch) => (
                        <label key={branch.id} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={filterBranches.includes(branch.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFilterBranches([...filterBranches, branch.id]);
                              } else {
                                setFilterBranches(filterBranches.filter(id => id !== branch.id));
                              }
                            }}
                          />
                          <span className="text-sm">{branch.name} - {branch.city}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-[200px] justify-start bg-background text-xs sm:text-sm">
                      {filterCategories.length === 0 
                        ? 'Filter by categories' 
                        : `${filterCategories.length} categor${filterCategories.length > 1 ? 'ies' : 'y'} selected`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[250px] p-3 bg-background border-border z-50" align="start">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center mb-2">
                        <Label className="font-semibold">Categories</Label>
                        {filterCategories.length > 0 && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setFilterCategories([])}
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                      {categories?.map((category) => (
                        <label key={category.id} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={filterCategories.includes(category.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFilterCategories([...filterCategories, category.id]);
                              } else {
                                setFilterCategories(filterCategories.filter(id => id !== category.id));
                              }
                            }}
                          />
                          <span className="text-sm">{category.name}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="relative flex-1 w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                <Input
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs sm:text-sm"
                />
              </div>
              
              <div className="ml-auto w-full sm:w-auto">
                {isMobile ? (
                <Drawer open={openDialog === 'item'} onOpenChange={(open) => {
                  setOpenDialog(open ? 'item' : null);
                  if (!open) {
                    setEditingItem(null);
                    setSelectedModifierGroups([]);
                    setSelectedBranches([]);
                  }
                }}>
                  <DrawerTrigger asChild>
                    <Button onClick={async () => {
                      setEditingItem(null);
                      setSelectedModifierGroups([]);
                      setSelectedBranches([]);
                      setBranchPrices({});
                      setUploadedImageUrl('');
                    }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Item
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent className="max-h-[90vh]">
                    <DrawerHeader className="flex flex-row items-center justify-between">
                      <DrawerTitle>{editingItem ? 'Edit' : 'Add'} Menu Item</DrawerTitle>
                      <Button type="submit" form="menu-item-form-drawer" size="sm" disabled={createItemMutation.isPending || updateItemMutation.isPending}>
                        {(createItemMutation.isPending || updateItemMutation.isPending) ? 'Saving...' : `${editingItem ? 'Update' : 'Create'} Item`}
                      </Button>
                    </DrawerHeader>
                    <div className="overflow-y-auto px-4 pb-4">
                      <form id="menu-item-form-drawer" onSubmit={handleSubmitItem} className="space-y-4">
                        <div>
                          <Label htmlFor="name">Name</Label>
                          <Input id="name" name="name" defaultValue={editingItem?.name} required />
                        </div>
                        <div>
                          <Label htmlFor="description">Description</Label>
                          <Textarea id="description" name="description" defaultValue={editingItem?.description} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="category_id">Category</Label>
                            <Select name="category_id" defaultValue={editingItem?.category_id} required>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories?.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.id}>
                                    {cat.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="tax_rate">Tax %</Label>
                            <Input 
                              id="tax_rate" 
                              name="tax_rate" 
                              type="number" 
                              step="0.01"
                              min="0"
                              max="100"
                              defaultValue={editingItem?.tax_rate ?? tenantVatRate ?? 10} 
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            id="tax_included_in_price" 
                            name="tax_included_in_price"
                            defaultChecked={editingItem?.tax_included_in_price ?? true} 
                          />
                          <Label htmlFor="tax_included_in_price" className="text-sm cursor-pointer">Tax included in price</Label>
                        </div>
                        <input type="hidden" name="price" value="0" />
                        
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <Label>Assign to Branches</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button 
                                  type="button"
                                  variant="outline" 
                                  className="w-full justify-start bg-background"
                                  onDoubleClick={() => setShowBranchSearch(!showBranchSearch)}
                                >
                                  {selectedBranches.length === 0 
                                    ? 'Select branches' 
                                    : `${selectedBranches.length} branch${selectedBranches.length > 1 ? 'es' : ''} selected`}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[350px] p-3 bg-background border-border z-[10001]" align="start">
                                <div className="space-y-3">
                                  <div className="flex justify-between items-center">
                                    <Label className="font-semibold">Select Branches</Label>
                                    {selectedBranches.length > 0 && (
                                      <Button 
                                        type="button"
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => {
                                          setSelectedBranches([]);
                                          setBranchPrices({});
                                        }}
                                      >
                                        Clear
                                      </Button>
                                    )}
                                  </div>
                                  {showBranchSearch && (
                                    <Input
                                      placeholder="Search branches..."
                                      value={branchSearch}
                                      onChange={(e) => setBranchSearch(e.target.value)}
                                      className="h-9"
                                    />
                                  )}
                                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                                    {branches?.filter(branch => 
                                      !showBranchSearch || 
                                      branch.name.toLowerCase().includes(branchSearch.toLowerCase()) ||
                                      branch.city.toLowerCase().includes(branchSearch.toLowerCase())
                                    ).map((branch) => (
                                      <label key={branch.id} className="flex items-center gap-2 cursor-pointer">
                                        <Checkbox
                                          checked={selectedBranches.includes(branch.id)}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setSelectedBranches([...selectedBranches, branch.id]);
                                              setBranchPrices({
                                                ...branchPrices,
                                                [branch.id]: ''
                                              });
                                            } else {
                                              setSelectedBranches(selectedBranches.filter(id => id !== branch.id));
                                              const newPrices = { ...branchPrices };
                                              delete newPrices[branch.id];
                                              setBranchPrices(newPrices);
                                            }
                                          }}
                                        />
                                        <span className="text-sm font-medium">{branch.name} - {branch.city}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                        
                        {selectedBranches.length > 0 && (
                          <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-semibold">Branch Prices</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Price (€)"
                                  value={masterPrice}
                                  onChange={(e) => setMasterPrice(e.target.value)}
                                  className="h-8 w-24"
                                />
                                <Button 
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    if (masterPrice) {
                                      const newPrices = { ...branchPrices };
                                      selectedBranches.forEach(branchId => {
                                        newPrices[branchId] = masterPrice;
                                      });
                                      setBranchPrices(newPrices);
                                    }
                                  }}
                                >
                                  Apply to All
                                </Button>
                              </div>
                            </div>
                            {selectedBranches.map((branchId) => {
                              const branch = branches?.find(b => b.id === branchId);
                              return (
                                <div key={branchId} className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">{branch?.name} - {branch?.city}</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="Enter price (€)"
                                    value={branchPrices[branchId] || ''}
                                    onChange={(e) => {
                                      setBranchPrices({
                                        ...branchPrices,
                                        [branchId]: e.target.value
                                      });
                                    }}
                                    required
                                  />
                                </div>
                              );
                            })}
                          </div>
                          )}
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <Label>Modifier Groups</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button 
                                  type="button"
                                  variant="outline" 
                                  className="w-full justify-start bg-background"
                                  onDoubleClick={() => setShowModifierSearch(!showModifierSearch)}
                                >
                                  {selectedModifierGroups.length === 0 
                                    ? 'Select modifier groups' 
                                    : `${selectedModifierGroups.length} modifier group${selectedModifierGroups.length > 1 ? 's' : ''} selected`}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[350px] p-3 bg-background border-border z-[10001]" align="start">
                                <div className="space-y-3">
                                  <div className="flex justify-between items-center">
                                    <Label className="font-semibold">Select Modifier Groups</Label>
                                    {selectedModifierGroups.length > 0 && (
                                      <Button 
                                        type="button"
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => setSelectedModifierGroups([])}
                                      >
                                        Clear
                                      </Button>
                                    )}
                                  </div>
                                  {showModifierSearch && (
                                    <Input
                                      placeholder="Search modifiers..."
                                      value={modifierSearch}
                                      onChange={(e) => setModifierSearch(e.target.value)}
                                      className="h-9"
                                    />
                                  )}
                                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                                    {modifierGroups?.filter(group => 
                                      !showModifierSearch || 
                                      group.name.toLowerCase().includes(modifierSearch.toLowerCase())
                                    ).map((group) => (
                                      <label key={group.id} className="flex items-center gap-2 cursor-pointer">
                                        <Checkbox
                                          checked={selectedModifierGroups.includes(group.id)}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setSelectedModifierGroups([...selectedModifierGroups, group.id]);
                                            } else {
                                              setSelectedModifierGroups(selectedModifierGroups.filter(id => id !== group.id));
                                            }
                                          }}
                                        />
                                        <span className="text-sm font-medium">{group.name}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                            
                            {selectedModifierGroups.length > 0 && (
                              <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
                                <Label className="text-sm font-semibold">Selected Modifiers</Label>
                                {selectedModifierGroups.map((groupId) => {
                                  const group = modifierGroups?.find(g => g.id === groupId);
                                  return (
                                    <div key={groupId} className="text-xs text-muted-foreground">
                                      • {group?.name}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-3">
                            <Label>Allergens</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button 
                                  type="button"
                                  variant="outline" 
                                  className="w-full justify-start bg-background"
                                >
                                  {selectedAllergens.length === 0 
                                    ? 'Select allergens' 
                                    : `${selectedAllergens.length} allergen${selectedAllergens.length > 1 ? 's' : ''} selected`}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[350px] p-3 bg-background border-border z-[10001]" align="start">
                                <div className="space-y-3">
                                  <div className="flex justify-between items-center">
                                    <Label className="font-semibold">Select Allergens</Label>
                                    {selectedAllergens.length > 0 && (
                                      <Button 
                                        type="button"
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => setSelectedAllergens([])}
                                      >
                                        Clear
                                      </Button>
                                    )}
                                  </div>
                                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                                    {allergens?.map((allergen) => (
                                      <label key={allergen.id} className="flex items-center gap-2 cursor-pointer">
                                        <Checkbox
                                          checked={selectedAllergens.includes(allergen.id)}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setSelectedAllergens([...selectedAllergens, allergen.id]);
                                            } else {
                                              setSelectedAllergens(selectedAllergens.filter(id => id !== allergen.id));
                                            }
                                          }}
                                        />
                                        <span className="text-sm font-medium">{allergen.name}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                            
                            {selectedAllergens.length > 0 && (
                              <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
                                <Label className="text-sm font-semibold">Selected Allergens</Label>
                                {selectedAllergens.map((allergenId) => {
                                  const allergen = allergens?.find(a => a.id === allergenId);
                                  return (
                                    <div key={allergenId} className="text-xs text-muted-foreground">
                                      • {allergen?.name}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <Label>Image</Label>
                          <ImageUpload
                            currentImageUrl={uploadedImageUrl || editingItem?.image_url}
                            onUploadComplete={setUploadedImageUrl}
                            onRemove={() => {
                              setUploadedImageUrl('');
                              if (editingItem) {
                                setEditingItem({ ...editingItem, image_url: null });
                              }
                            }}
                            folder="menu-items"
                          />
                          <Input type="hidden" name="image_url" value={uploadedImageUrl || editingItem?.image_url || ''} />
                        </div>
                        
                        <div className="space-y-3">
                          <Label>Availability Schedule</Label>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2">
                              <input 
                                type="radio" 
                                name="disable_option" 
                                value="none" 
                                defaultChecked 
                                onChange={() => setShowCustomDate(false)}
                              />
                              <span>Available</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <input 
                                type="radio" 
                                name="disable_option" 
                                value="1day" 
                                onChange={() => setShowCustomDate(false)}
                              />
                              <span>Disable for 1 day</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <input 
                                type="radio" 
                                name="disable_option" 
                                value="1week" 
                                onChange={() => setShowCustomDate(false)}
                              />
                              <span>Disable for 1 week</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <input 
                                type="radio" 
                                name="disable_option" 
                                value="custom" 
                                onChange={() => setShowCustomDate(true)}
                              />
                              <span>Custom date</span>
                            </label>
                            {showCustomDate && (
                              <Input 
                                type="datetime-local" 
                                name="custom_disabled_until"
                                className="ml-6"
                              />
                            )}
                            <label className="flex items-center gap-2 mt-2 pt-2 border-t">
                              <input type="checkbox" name="disabled_permanently" defaultChecked={editingItem?.disabled_permanently} />
                              <span>Disable Permanently</span>
                            </label>
                          </div>
                        </div>
                        
                        <div className="flex gap-4 flex-wrap">
                          <label className="flex items-center gap-2">
                            <input type="checkbox" name="is_featured" defaultChecked={editingItem?.is_featured} />
                            <span>Featured</span>
                          </label>
                        </div>
                      </form>
                    </div>
                  </DrawerContent>
                </Drawer>
              ) : (
                <Dialog open={openDialog === 'item'} onOpenChange={(open) => {
                  setOpenDialog(open ? 'item' : null);
                  if (!open) {
                    setEditingItem(null);
                    setSelectedModifierGroups([]);
                    setSelectedBranches([]);
                    setBranchPrices({});
                    setUploadedImageUrl('');
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button onClick={async () => {
                      setEditingItem(null);
                      setSelectedModifierGroups([]);
                      setSelectedBranches([]);
                      setBranchPrices({});
                      setUploadedImageUrl('');
                    }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Item
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="flex flex-row items-center justify-between">
                      <DialogTitle>{editingItem ? 'Edit' : 'Add'} Menu Item</DialogTitle>
                      <Button type="submit" form="menu-item-form-dialog" size="sm" disabled={createItemMutation.isPending || updateItemMutation.isPending}>
                        {(createItemMutation.isPending || updateItemMutation.isPending) ? 'Saving...' : `${editingItem ? 'Update' : 'Create'} Item`}
                      </Button>
                    </DialogHeader>
                    <form id="menu-item-form-dialog" onSubmit={handleSubmitItem} className="space-y-4">
                      <div>
                        <Label htmlFor="name">Name</Label>
                        <Input id="name" name="name" defaultValue={editingItem?.name} required />
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" name="description" defaultValue={editingItem?.description} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="category_id">Category</Label>
                          <Select name="category_id" defaultValue={editingItem?.category_id} required>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories?.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="tax_rate">Tax %</Label>
                          <Input 
                            id="tax_rate" 
                            name="tax_rate" 
                            type="number" 
                            step="0.01"
                            min="0"
                            max="100"
                            defaultValue={editingItem?.tax_rate ?? tenantVatRate ?? 10} 
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="tax_included_in_price" 
                          name="tax_included_in_price"
                          defaultChecked={editingItem?.tax_included_in_price ?? true} 
                        />
                        <Label htmlFor="tax_included_in_price" className="text-sm cursor-pointer">Tax included in price</Label>
                      </div>
                      <input type="hidden" name="price" value="0" />
                      
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <Label>Assign to Branches</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button 
                                type="button"
                                variant="outline" 
                                className="w-full justify-start bg-background"
                                onDoubleClick={() => setShowBranchSearch(!showBranchSearch)}
                              >
                                {selectedBranches.length === 0 
                                  ? 'Select branches' 
                                  : `${selectedBranches.length} branch${selectedBranches.length > 1 ? 'es' : ''} selected`}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[350px] p-3 bg-background border-border z-[10001]" align="start">
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <Label className="font-semibold">Select Branches</Label>
                                  {selectedBranches.length > 0 && (
                                    <Button 
                                      type="button"
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => {
                                        setSelectedBranches([]);
                                        setBranchPrices({});
                                      }}
                                    >
                                      Clear
                                    </Button>
                                  )}
                                </div>
                                {showBranchSearch && (
                                  <Input
                                    placeholder="Search branches..."
                                    value={branchSearch}
                                    onChange={(e) => setBranchSearch(e.target.value)}
                                    className="h-9"
                                  />
                                )}
                                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                                  {branches?.filter(branch => 
                                    !showBranchSearch || 
                                    branch.name.toLowerCase().includes(branchSearch.toLowerCase()) ||
                                    branch.city.toLowerCase().includes(branchSearch.toLowerCase())
                                  ).map((branch) => (
                                    <label key={branch.id} className="flex items-center gap-2 cursor-pointer">
                                      <Checkbox
                                        checked={selectedBranches.includes(branch.id)}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            setSelectedBranches([...selectedBranches, branch.id]);
                                            setBranchPrices({
                                              ...branchPrices,
                                              [branch.id]: ''
                                            });
                                          } else {
                                            setSelectedBranches(selectedBranches.filter(id => id !== branch.id));
                                            const newPrices = { ...branchPrices };
                                            delete newPrices[branch.id];
                                            setBranchPrices(newPrices);
                                          }
                                        }}
                                      />
                                      <span className="text-sm font-medium">{branch.name} - {branch.city}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      
                      {selectedBranches.length > 0 && (
                        <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold">Branch Prices</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Price (€)"
                                value={masterPrice}
                                onChange={(e) => setMasterPrice(e.target.value)}
                                className="h-8 w-24"
                              />
                              <Button 
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  if (masterPrice) {
                                    const newPrices = { ...branchPrices };
                                    selectedBranches.forEach(branchId => {
                                      newPrices[branchId] = masterPrice;
                                    });
                                    setBranchPrices(newPrices);
                                  }
                                }}
                              >
                                Apply to All
                              </Button>
                            </div>
                          </div>
                          {selectedBranches.map((branchId) => {
                            const branch = branches?.find(b => b.id === branchId);
                            return (
                              <div key={branchId} className="space-y-1">
                                <Label className="text-xs text-muted-foreground">{branch?.name} - {branch?.city}</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Enter price (€)"
                                  value={branchPrices[branchId] || ''}
                                  onChange={(e) => {
                                    setBranchPrices({
                                      ...branchPrices,
                                      [branchId]: e.target.value
                                    });
                                  }}
                                  required
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <Label>Modifier Groups</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button 
                                type="button"
                                variant="outline" 
                                className="w-full justify-start bg-background"
                                onDoubleClick={() => setShowModifierSearch(!showModifierSearch)}
                              >
                                {selectedModifierGroups.length === 0 
                                  ? 'Select modifier groups' 
                                  : `${selectedModifierGroups.length} modifier group${selectedModifierGroups.length > 1 ? 's' : ''} selected`}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[350px] p-3 bg-background border-border z-[10001]" align="start">
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <Label className="font-semibold">Select Modifier Groups</Label>
                                  {selectedModifierGroups.length > 0 && (
                                    <Button 
                                      type="button"
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => setSelectedModifierGroups([])}
                                    >
                                      Clear
                                    </Button>
                                  )}
                                </div>
                                {showModifierSearch && (
                                  <Input
                                    placeholder="Search modifiers..."
                                    value={modifierSearch}
                                    onChange={(e) => setModifierSearch(e.target.value)}
                                    className="h-9"
                                  />
                                )}
                                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                                  {modifierGroups?.filter(group => 
                                    !showModifierSearch || 
                                    group.name.toLowerCase().includes(modifierSearch.toLowerCase())
                                  ).map((group) => (
                                    <label key={group.id} className="flex items-center gap-2 cursor-pointer">
                                      <Checkbox
                                        checked={selectedModifierGroups.includes(group.id)}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            setSelectedModifierGroups([...selectedModifierGroups, group.id]);
                                          } else {
                                            setSelectedModifierGroups(selectedModifierGroups.filter(id => id !== group.id));
                                          }
                                        }}
                                      />
                                      <span className="text-sm font-medium">{group.name}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                          
                          {selectedModifierGroups.length > 0 && (
                            <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
                              <Label className="text-sm font-semibold">Selected Modifiers</Label>
                              {selectedModifierGroups.map((groupId) => {
                                const group = modifierGroups?.find(g => g.id === groupId);
                                return (
                                  <div key={groupId} className="text-xs text-muted-foreground">
                                    • {group?.name}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-3">
                          <Label>Allergens</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button 
                                type="button"
                                variant="outline" 
                                className="w-full justify-start bg-background"
                              >
                                {selectedAllergens.length === 0 
                                  ? 'Select allergens' 
                                  : `${selectedAllergens.length} allergen${selectedAllergens.length > 1 ? 's' : ''} selected`}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[350px] p-3 bg-background border-border z-[10001]" align="start">
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <Label className="font-semibold">Select Allergens</Label>
                                  {selectedAllergens.length > 0 && (
                                    <Button 
                                      type="button"
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => setSelectedAllergens([])}
                                    >
                                      Clear
                                    </Button>
                                  )}
                                </div>
                                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                                  {allergens?.map((allergen) => (
                                    <label key={allergen.id} className="flex items-center gap-2 cursor-pointer">
                                      <Checkbox
                                        checked={selectedAllergens.includes(allergen.id)}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            setSelectedAllergens([...selectedAllergens, allergen.id]);
                                          } else {
                                            setSelectedAllergens(selectedAllergens.filter(id => id !== allergen.id));
                                          }
                                        }}
                                      />
                                      <span className="text-sm font-medium">{allergen.name}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                          
                          {selectedAllergens.length > 0 && (
                            <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
                              <Label className="text-sm font-semibold">Selected Allergens</Label>
                              {selectedAllergens.map((allergenId) => {
                                const allergen = allergens?.find(a => a.id === allergenId);
                                return (
                                  <div key={allergenId} className="text-xs text-muted-foreground">
                                    • {allergen?.name}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <Label>Image</Label>
                        <ImageUpload
                          currentImageUrl={uploadedImageUrl || editingItem?.image_url}
                          onUploadComplete={setUploadedImageUrl}
                          onRemove={() => {
                            setUploadedImageUrl('');
                            if (editingItem) {
                              setEditingItem({ ...editingItem, image_url: null });
                            }
                          }}
                          folder="menu-items"
                        />
                        <Input type="hidden" name="image_url" value={uploadedImageUrl || editingItem?.image_url || ''} />
                      </div>
                      
                      <div className="space-y-3">
                        <Label>Availability Schedule</Label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2">
                            <input 
                              type="radio" 
                              name="disable_option" 
                              value="none" 
                              defaultChecked 
                              onChange={() => setShowCustomDate(false)}
                            />
                            <span>Available</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input 
                              type="radio" 
                              name="disable_option" 
                              value="1day" 
                              onChange={() => setShowCustomDate(false)}
                            />
                            <span>Disable for 1 day</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input 
                              type="radio" 
                              name="disable_option" 
                              value="1week" 
                              onChange={() => setShowCustomDate(false)}
                            />
                            <span>Disable for 1 week</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input 
                              type="radio" 
                              name="disable_option" 
                              value="custom" 
                              onChange={() => setShowCustomDate(true)}
                            />
                            <span>Custom date</span>
                          </label>
                          {showCustomDate && (
                            <Input 
                              type="datetime-local" 
                              name="custom_disabled_until"
                              className="ml-6"
                            />
                          )}
                          <label className="flex items-center gap-2 mt-2 pt-2 border-t">
                            <input type="checkbox" name="disabled_permanently" defaultChecked={editingItem?.disabled_permanently} />
                            <span>Disable Permanently</span>
                          </label>
                        </div>
                      </div>
                      
                      <div className="flex gap-4 flex-wrap">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="is_featured" defaultChecked={editingItem?.is_featured} />
                          <span>Featured</span>
                        </label>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
               )}
              </div>
            </div>

            <Card>
              {/* Mobile/Tablet: card layout */}
              <div className="block lg:hidden">
                <MobileMenuItemCards
                  items={filteredMenuItems || []}
                  getPriceLabel={getPriceLabel}
                  onEdit={async (item) => {
                    const modifiers = item.menu_item_modifiers?.map((m: any) => m.modifier_group_id) || [];
                    setSelectedModifierGroups(modifiers);
                    setEditingItem(item);
                    const { data: branchAssignments } = await supabase
                      .from('branch_menu_items')
                      .select('branch_id, price_override')
                      .eq('menu_item_id', item.id);
                    const branchIds = branchAssignments?.map(ba => ba.branch_id) || [];
                    setSelectedBranches(branchIds);
                    const prices: Record<string, string> = {};
                    branchAssignments?.forEach(ba => {
                      if (ba.price_override) {
                        prices[ba.branch_id] = ba.price_override.toString();
                      }
                    });
                    setBranchPrices(prices);
                    const { data: allergenAssignments } = await supabase
                      .from('menu_item_allergens')
                      .select('allergen_id')
                      .eq('menu_item_id', item.id);
                    const allergenIds = allergenAssignments?.map(aa => aa.allergen_id) || [];
                    setSelectedAllergens(allergenIds);
                    setOpenDialog('item');
                  }}
                  onDelete={(item) => {
                    if (confirm('Are you sure you want to delete this menu item?')) {
                      deleteItemMutation.mutate(item.id);
                    }
                  }}
                />
              </div>
              {/* Desktop: table layout */}
              <CardContent className="p-0 hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMenuItems?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.menu_categories?.name}</TableCell>
                        <TableCell>{getPriceLabel(item.id, item.price)}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            item.is_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {item.is_available ? 'Available' : 'Unavailable'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                const modifiers = item.menu_item_modifiers?.map((m: any) => m.modifier_group_id) || [];
                                setSelectedModifierGroups(modifiers);
                                setEditingItem(item);
                                const { data: branchAssignments } = await supabase
                                  .from('branch_menu_items')
                                  .select('branch_id, price_override')
                                  .eq('menu_item_id', item.id);
                                const branchIds = branchAssignments?.map(ba => ba.branch_id) || [];
                                setSelectedBranches(branchIds);
                                const prices: Record<string, string> = {};
                                branchAssignments?.forEach(ba => {
                                  if (ba.price_override) {
                                    prices[ba.branch_id] = ba.price_override.toString();
                                  }
                                });
                                setBranchPrices(prices);
                                const { data: allergenAssignments } = await supabase
                                  .from('menu_item_allergens')
                                  .select('allergen_id')
                                  .eq('menu_item_id', item.id);
                                const allergenIds = allergenAssignments?.map(aa => aa.allergen_id) || [];
                                setSelectedAllergens(allergenIds);
                                setOpenDialog('item');
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={deleteItemMutation.isPending}
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this menu item?')) {
                                  deleteItemMutation.mutate(item.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <CategoryManagement />
          </TabsContent>

          <TabsContent value="modifiers">
            <ModifierManagement />
          </TabsContent>

          <TabsContent value="allergens">
            <AllergenManagement />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
    <UnsavedChangesDialog open={showDialog} onConfirmLeave={confirmLeave} onCancelLeave={cancelLeave} />
    </>
  );
}
