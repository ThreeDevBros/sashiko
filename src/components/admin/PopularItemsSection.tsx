import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, Plus, X, Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';

const MAX_SLOTS = 10;

interface MenuItemOption {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
}

export default function PopularItemsSection() {
  const queryClient = useQueryClient();
  const [sectionTitle, setSectionTitle] = useState('Popular Items');
  const [sectionDescription, setSectionDescription] = useState('Customer favorites');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSlotIndex, setPickerSlotIndex] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  // Fetch branches
  const { data: branches } = useQuery({
    queryKey: ['admin-branches-popular'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Auto-select first branch
  useEffect(() => {
    if (branches && branches.length > 0 && !selectedBranchId) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, selectedBranchId]);

  const { data: settings } = useQuery({
    queryKey: ['tenant-settings-popular'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('id, popular_section_title, popular_section_description, currency')
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch branch-specific popular items
  const { data: branchPopularData } = useQuery({
    queryKey: ['branch-popular-items', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return null;
      const { data, error } = await supabase
        .from('branch_popular_items')
        .select('*')
        .eq('branch_id', selectedBranchId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedBranchId,
  });

  // Fetch menu items available at the selected branch
  const { data: menuItems } = useQuery({
    queryKey: ['branch-menu-items-for-popular', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const { data, error } = await supabase
        .from('branch_menu_items')
        .select(`
          menu_item_id,
          price_override,
          menu_items (id, name, price, image_url)
        `)
        .eq('branch_id', selectedBranchId)
        .eq('is_available', true);
      if (error) throw error;
      return (data || [])
        .filter((d: any) => d.menu_items)
        .map((d: any) => ({
          id: d.menu_items.id,
          name: d.menu_items.name,
          price: d.price_override ?? d.menu_items.price,
          image_url: d.menu_items.image_url,
        } as MenuItemOption))
        .sort((a: MenuItemOption, b: MenuItemOption) => a.name.localeCompare(b.name));
    },
    enabled: !!selectedBranchId,
  });

  // Load selected items details for preview
  const { data: selectedItems } = useQuery({
    queryKey: ['popular-selected-items', selectedIds],
    queryFn: async () => {
      if (selectedIds.length === 0) return [];
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, price, image_url')
        .in('id', selectedIds);
      if (error) throw error;
      const map = new Map((data || []).map(i => [i.id, i]));
      return selectedIds.map(id => map.get(id)).filter(Boolean) as MenuItemOption[];
    },
    enabled: selectedIds.length > 0,
  });

  // Load branch popular items into state (title, description, and items)
  useEffect(() => {
    if (branchPopularData) {
      setSelectedIds((branchPopularData as any).popular_item_ids || []);
      setSectionTitle((branchPopularData as any).section_title || 'Popular Items');
      setSectionDescription((branchPopularData as any).section_description || 'Customer favorites');
    } else {
      setSelectedIds([]);
      setSectionTitle('Popular Items');
      setSectionDescription('Customer favorites');
    }
  }, [branchPopularData]);

  const currency = (settings as any)?.currency || 'USD';

  const openPicker = (slotIndex: number) => {
    setPickerSlotIndex(slotIndex);
    setSearchQuery('');
    setPickerOpen(true);
  };

  const selectItem = (item: MenuItemOption) => {
    setSelectedIds(prev => {
      const next = [...prev];
      if (pickerSlotIndex < next.length) {
        next[pickerSlotIndex] = item.id;
      } else {
        next.push(item.id);
      }
      return next;
    });
    setPickerOpen(false);
  };

  const removeItem = (index: number) => {
    setSelectedIds(prev => prev.filter((_, i) => i !== index));
  };

  const filteredMenuItems = (menuItems || []).filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSave = async () => {
    if (!settings?.id || !selectedBranchId) return;
    setIsSaving(true);
    try {
      // Upsert branch-specific popular items with title/description
      const { error: branchError } = await supabase
        .from('branch_popular_items')
        .upsert({
          branch_id: selectedBranchId,
          popular_item_ids: selectedIds,
          section_title: sectionTitle,
          section_description: sectionDescription,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: 'branch_id' });
      if (branchError) throw branchError;

      queryClient.invalidateQueries({ queryKey: ['tenant-settings-popular'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-branding'] });
      queryClient.invalidateQueries({ queryKey: ['branch-popular-items'] });
      queryClient.invalidateQueries({ queryKey: ['popular-items-home'] });
      toast.success('Popular items section saved!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save popular items section');
    } finally {
      setIsSaving(false);
    }
  };

  const getSlotItem = (index: number): MenuItemOption | null => {
    if (!selectedItems || index >= selectedIds.length) return null;
    return selectedItems[index] || null;
  };

  return (
    <>
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5" /> Popular Items Section
              </CardTitle>
              <CardDescription>Control the popular items block shown on the homepage</CardDescription>
            </div>
            {branches && branches.length > 0 && (
              <Select value={selectedBranchId || ''} onValueChange={setSelectedBranchId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="popular-title">Section Title</Label>
              <Input
                id="popular-title"
                value={sectionTitle}
                onChange={(e) => setSectionTitle(e.target.value)}
                placeholder="e.g. Popular Items"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="popular-desc">Section Description</Label>
              <Input
                id="popular-desc"
                value={sectionDescription}
                onChange={(e) => setSectionDescription(e.target.value)}
                placeholder="e.g. Customer favorites"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Featured Items ({selectedIds.length} / {MAX_SLOTS})</Label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Array.from({ length: MAX_SLOTS }).map((_, idx) => {
                const item = getSlotItem(idx);
                if (item) {
                  return (
                    <div key={idx} className="relative group rounded-lg border border-border overflow-hidden bg-muted/30 aspect-square">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-xs text-center p-1">
                          {item.name}
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1.5">
                        <p className="text-white text-xs font-medium truncate">{item.name}</p>
                        <p className="text-white/70 text-[10px]">{formatCurrency(item.price, currency)}</p>
                      </div>
                      <button
                        onClick={() => removeItem(idx)}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => openPicker(idx)}
                        className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors cursor-pointer"
                      />
                    </div>
                  );
                }
                return (
                  <button
                    key={idx}
                    onClick={() => openPicker(idx)}
                    disabled={idx > selectedIds.length}
                    className="rounded-lg border-2 border-dashed border-border aspect-square flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="text-[10px]">Select Item</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Button className="w-full" onClick={handleSave} disabled={isSaving || !selectedBranchId}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Popular Items Settings
          </Button>
        </CardContent>
      </Card>

      {/* Item Picker Dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Menu Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-[300px]">
              <div className="space-y-1">
                {filteredMenuItems.map((item) => {
                  const alreadySelected = selectedIds.includes(item.id) && selectedIds[pickerSlotIndex] !== item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => !alreadySelected && selectItem(item)}
                      disabled={alreadySelected}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left disabled:opacity-40"
                    >
                      <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[8px] text-muted-foreground">No img</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(item.price, currency)}</p>
                      </div>
                      {alreadySelected && <span className="text-[10px] text-muted-foreground">Already added</span>}
                    </button>
                  );
                })}
                {filteredMenuItems.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No items found</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
