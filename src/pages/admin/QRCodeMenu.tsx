import { useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, QrCode, ExternalLink } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatCurrency } from '@/lib/currency';
import { useBranding } from '@/hooks/useBranding';
import type { MenuCategory, MenuItem as MenuItemType } from '@/types';

const QRCodeMenu = () => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const qrRef = useRef<HTMLDivElement>(null);
  const { branding } = useBranding();
  const currency = branding?.currency || 'USD';

  const { data: branches, isLoading: branchesLoading } = useQuery({
    queryKey: ['admin-branches-qr'],
    queryFn: async () => {
      const { data, error } = await supabase.from('branches').select('id, name, address, city').eq('is_active', true).order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: categories } = useQuery<MenuCategory[]>({
    queryKey: ['admin-qr-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('menu_categories').select('*').eq('is_active', true).order('display_order');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: menuItems, isLoading: menuLoading } = useQuery<MenuItemType[]>({
    queryKey: ['admin-qr-menu-items', selectedBranchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branch_menu_items')
        .select(`*, menu_items (id, name, description, price, image_url, is_featured, is_vegetarian, is_vegan, calories, category_id)`)
        .eq('branch_id', selectedBranchId)
        .eq('is_available', true);
      if (error) throw error;
      return data?.map(item => ({
        ...item.menu_items,
        price: item.price_override || item.menu_items.price,
      })) || [];
    },
    enabled: !!selectedBranchId,
  });

  const selectedBranch = branches?.find(b => b.id === selectedBranchId);
  const menuUrl = selectedBranchId ? `${window.location.origin}/qr-menu/${selectedBranchId}` : '';

  const categoriesWithItems = categories?.filter(cat => menuItems?.some(item => item.category_id === cat.id)) || [];

  const handleExportQR = useCallback(() => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const size = 1024;
    const padding = 80;
    canvas.width = size + padding * 2;
    canvas.height = size + padding * 2;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, padding, padding, size, size);
      const link = document.createElement('a');
      link.download = `qr-menu-${selectedBranch?.name || 'branch'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }, [selectedBranch]);

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <QrCode className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">QR Code for Menu</h1>
        </div>

        {/* Branch Selector */}
        <Card className="p-4 bg-card border-border">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">Select Branch</label>
          <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={branchesLoading ? 'Loading...' : 'Choose a branch'} />
            </SelectTrigger>
            <SelectContent>
              {branches?.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.name} — {b.city}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        {selectedBranchId && (
          <>
            {/* Menu Preview */}
            <Card className="p-5 bg-card border-border">
              <h2 className="text-lg font-semibold text-foreground mb-1">Menu Preview</h2>
              <p className="text-xs text-muted-foreground mb-4">This is how the QR menu page will look for customers.</p>

              <div className="border border-border rounded-2xl bg-background overflow-hidden max-h-[500px] overflow-y-auto">
                {/* Preview Header */}
                <div className="bg-muted/50 border-b border-border px-4 py-4 text-center">
                  <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: branding?.font_family || 'inherit' }}>
                    {selectedBranch?.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">{selectedBranch?.address}, {selectedBranch?.city}</p>
                </div>

                {/* Preview Body */}
                <div className="p-4 space-y-6">
                  {menuLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
                    </div>
                  ) : categoriesWithItems.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No menu items for this branch.</p>
                  ) : (
                    categoriesWithItems.map(cat => {
                      const items = menuItems?.filter(i => i.category_id === cat.id) || [];
                      return (
                        <div key={cat.id}>
                          <h4 className="text-base font-bold text-foreground mb-2" style={{ fontFamily: branding?.font_family || 'inherit' }}>
                            {cat.name}
                          </h4>
                          <div className="space-y-2">
                            {items.map(item => (
                              <div key={item.id} className="flex gap-3 p-2.5 rounded-xl bg-card border border-border">
                                {item.image_url && (
                                  <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-foreground line-clamp-1">{item.name}</p>
                                  {item.description && <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>}
                                  <p className="text-sm font-bold text-primary mt-0.5">{formatCurrency(Number(item.price), currency)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Open link */}
              <div className="mt-3 flex justify-end">
                <a href={menuUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                  Open full page <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </Card>

            {/* QR Code */}
            <Card className="p-6 bg-card border-border flex flex-col items-center gap-5">
              <h2 className="text-lg font-semibold text-foreground self-start">QR Code</h2>
              <div ref={qrRef} className="bg-white p-6 rounded-2xl">
                <QRCodeSVG value={menuUrl} size={220} level="H" />
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-sm break-all">{menuUrl}</p>
              <Button onClick={handleExportQR} className="bg-[hsl(210,80%,55%)] hover:bg-[hsl(210,80%,45%)] text-white gap-2">
                <Download className="w-4 h-4" />
                Export Menu QR Code as Image
              </Button>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default QRCodeMenu;
