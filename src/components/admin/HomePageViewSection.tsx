import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Monitor, Plus, Trash2, Upload, Move, Image as ImageIcon, Loader2, CalendarCheck, User, Package, Zap } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import PopularItemsSection from './PopularItemsSection';

export interface BannerItem {
  id: string;
  image_url: string;
  focus_x: number;
  focus_y: number;
  title: string;
  description: string;
}

interface BannerEditorData {
  id: string;
  imageFile: File | null;
  imagePreview: string | null;
  focus_x: number;
  focus_y: number;
  title: string;
  description: string;
}

const createEmptyBanner = (): BannerEditorData => ({
  id: crypto.randomUUID(),
  imageFile: null,
  imagePreview: null,
  focus_x: 50,
  focus_y: 50,
  title: '',
  description: '',
});

const bannerItemToEditor = (item: BannerItem): BannerEditorData => ({
  id: item.id,
  imageFile: null,
  imagePreview: item.image_url,
  focus_x: item.focus_x,
  focus_y: item.focus_y,
  title: item.title,
  description: item.description,
});

const MAX_BANNERS = 6;

const TIMING_OPTIONS = [
  { label: '7 seconds', value: '7' },
  { label: '9 seconds', value: '9' },
  { label: '11 seconds', value: '11' },
  { label: '13 seconds', value: '13' },
  { label: '15 seconds', value: '15' },
  { label: 'Custom', value: 'custom' },
];

function BannerEditor({
  banner, index, onChange, onRemove, showRemove,
}: {
  banner: BannerEditorData; index: number;
  onChange: (updated: BannerEditorData) => void;
  onRemove: () => void; showRemove: boolean;
}) {
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange({ ...banner, imageFile: file, imagePreview: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Banner {index + 1}</h4>
        {showRemove && (
          <Button variant="ghost" size="sm" onClick={onRemove} className="text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4 mr-1" /> Remove
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-xs font-medium">
          <Upload className="w-3.5 h-3.5" /> Banner Image
        </Label>
        {banner.imagePreview ? (
          <div className="relative w-full h-36 rounded-md overflow-hidden border border-border"
            style={{ backgroundImage: `url(${banner.imagePreview})`, backgroundSize: 'cover', backgroundPosition: `${banner.focus_x}% ${banner.focus_y}%` }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-white/80 bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Move className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-36 rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageIcon className="w-8 h-8" /><span className="text-xs">Upload a banner image</span>
          </div>
        )}
        <Input type="file" accept="image/*" onChange={handleImageChange} />
      </div>

      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-xs font-medium">
          <Move className="w-3.5 h-3.5" /> Image Focus Position
        </Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Horizontal ({banner.focus_x}%)</Label>
            <Slider value={[banner.focus_x]} onValueChange={([v]) => onChange({ ...banner, focus_x: v })} min={0} max={100} step={1} />
            <div className="flex justify-between text-[10px] text-muted-foreground"><span>Left</span><span>Center</span><span>Right</span></div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Vertical ({banner.focus_y}%)</Label>
            <Slider value={[banner.focus_y]} onValueChange={([v]) => onChange({ ...banner, focus_y: v })} min={0} max={100} step={1} />
            <div className="flex justify-between text-[10px] text-muted-foreground"><span>Top</span><span>Center</span><span>Bottom</span></div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`banner-title-${banner.id}`} className="text-xs font-medium">Title</Label>
        <Input id={`banner-title-${banner.id}`} value={banner.title} onChange={(e) => onChange({ ...banner, title: e.target.value })} placeholder="e.g. Fresh Asian flavors, delivered fast" />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`banner-desc-${banner.id}`} className="text-xs font-medium">Description</Label>
        <Textarea id={`banner-desc-${banner.id}`} value={banner.description} onChange={(e) => onChange({ ...banner, description: e.target.value })} placeholder="e.g. Order now and get your meal in 30–40 minutes" rows={2} className="resize-none" />
      </div>
    </div>
  );
}

export default function HomePageViewSection() {
  const queryClient = useQueryClient();
  const [bannerStyle, setBannerStyle] = useState<'single' | 'slideshow'>('single');
  const [singleBanner, setSingleBanner] = useState<BannerEditorData>(createEmptyBanner());
  const [slideshowBanners, setSlideshowBanners] = useState<BannerEditorData[]>([createEmptyBanner()]);
  const [timingOption, setTimingOption] = useState('7');
  const [customTiming, setCustomTiming] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['tenant-settings-banner'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenant_settings').select('id, banner_style, banner_data, slideshow_interval_seconds, quick_actions_config').single();
      if (error) throw error;
      return data;
    },
  });

  // Load saved data into state
  useEffect(() => {
    if (!settings) return;
    const style = (settings.banner_style as 'single' | 'slideshow') || 'single';
    setBannerStyle(style);

    const banners = (settings.banner_data as unknown as BannerItem[]) || [];
    const interval = settings.slideshow_interval_seconds || 7;

    if (TIMING_OPTIONS.some(o => o.value === String(interval) && o.value !== 'custom')) {
      setTimingOption(String(interval));
    } else {
      setTimingOption('custom');
      setCustomTiming(String(interval));
    }

    if (style === 'single') {
      if (banners.length > 0) {
        setSingleBanner(bannerItemToEditor(banners[0]));
      }
    } else {
      if (banners.length > 0) {
        setSlideshowBanners(banners.map(bannerItemToEditor));
      }
    }
  }, [settings]);

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop();
    const fileName = `banner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('restaurant-images').upload(fileName, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('restaurant-images').getPublicUrl(fileName);
    return publicUrl;
  };

  const handleSave = async () => {
    if (!settings?.id) return;
    setIsSaving(true);
    try {
      const bannersToSave: BannerEditorData[] = bannerStyle === 'single' ? [singleBanner] : slideshowBanners;

      // Upload any new images
      const savedBanners: BannerItem[] = await Promise.all(
        bannersToSave.map(async (b) => {
          let image_url = b.imagePreview || '';
          if (b.imageFile) {
            image_url = await uploadImage(b.imageFile);
          }
          return {
            id: b.id,
            image_url,
            focus_x: b.focus_x,
            focus_y: b.focus_y,
            title: b.title,
            description: b.description,
          };
        })
      );

      const interval = timingOption === 'custom' ? parseInt(customTiming) || 7 : parseInt(timingOption);

      // Also update home_image_url and hero_title/hero_subtitle from first banner for backwards compat
      const firstBanner = savedBanners[0];
      const { error } = await supabase.from('tenant_settings').update({
        banner_style: bannerStyle,
        banner_data: savedBanners as any,
        slideshow_interval_seconds: interval,
        home_image_url: firstBanner?.image_url || null,
        hero_title: firstBanner?.title || null,
        hero_subtitle: firstBanner?.description || null,
      }).eq('id', settings.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['tenant-settings-banner'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-branding'] });
      toast.success('Home page settings saved!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save home page settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="w-5 h-5" /> Home Page View
        </CardTitle>
        <CardDescription>Control the homepage hero banner shown on the front page</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Main Banner Style</Label>
          <Select value={bannerStyle} onValueChange={(v) => setBannerStyle(v as 'single' | 'slideshow')}>
            <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single Banner</SelectItem>
              <SelectItem value="slideshow">Slideshow</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {bannerStyle === 'single' && (
          <BannerEditor banner={singleBanner} index={0} onChange={setSingleBanner} onRemove={() => {}} showRemove={false} />
        )}

        {bannerStyle === 'slideshow' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Max {MAX_BANNERS} different Banners</p>
                <p className="text-xs text-muted-foreground">Currently: {slideshowBanners.length} / {MAX_BANNERS}</p>
              </div>
              <div className="space-y-2 flex-1 max-w-xs">
                <Label>Time per banner</Label>
                <Select value={timingOption} onValueChange={setTimingOption}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMING_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {timingOption === 'custom' && (
                <div className="space-y-2 max-w-[140px]">
                  <Label>Seconds</Label>
                  <Input type="number" min={3} max={60} value={customTiming} onChange={(e) => setCustomTiming(e.target.value)} placeholder="e.g. 10" />
                </div>
              )}
            </div>

            <div className="space-y-4">
              {slideshowBanners.map((banner, idx) => (
                <BannerEditor key={banner.id} banner={banner} index={idx}
                  onChange={(updated) => setSlideshowBanners(prev => prev.map(b => b.id === banner.id ? updated : b))}
                  onRemove={() => setSlideshowBanners(prev => prev.filter(b => b.id !== banner.id))}
                  showRemove={slideshowBanners.length > 1} />
              ))}
            </div>

            {slideshowBanners.length < MAX_BANNERS && (
              <Button variant="outline" onClick={() => setSlideshowBanners(prev => [...prev, createEmptyBanner()])}
                className="w-full h-12 border-dashed text-muted-foreground hover:text-foreground">
                <Plus className="w-5 h-5 mr-2" /> Add More Banners
              </Button>
            )}
          </div>
        )}

        <Button className="w-full" onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Home Page Settings
        </Button>

        {/* Quick Actions */}
        <QuickActionsSubsection settingsId={settings?.id} config={(settings as any)?.quick_actions_config} />
      </CardContent>
    </Card>

    {/* Popular Items Section */}
    <PopularItemsSection />
  </>
  );
}

function QuickActionsSubsection({ settingsId, config: rawConfig }: { settingsId?: string; config?: Record<string, boolean> }) {
  const queryClient = useQueryClient();
  const config = rawConfig ?? { book_table: true, my_profile: true, my_orders: true };

  const actions = [
    { key: 'book_table', label: 'Book a Table', icon: CalendarCheck },
    { key: 'my_profile', label: 'My Profile', icon: User },
    
  ];

  const handleToggle = async (key: string, checked: boolean) => {
    if (!settingsId) return;
    const updated = { ...config, [key]: checked };
    const { error } = await supabase.from('tenant_settings').update({ quick_actions_config: updated } as any).eq('id', settingsId);
    if (error) { toast.error('Failed to update'); return; }
    queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
    queryClient.invalidateQueries({ queryKey: ['tenant-settings-banner'] });
    queryClient.invalidateQueries({ queryKey: ['tenant-branding'] });
  };

  return (
    <div className="space-y-4 pt-2">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4" />
          <Label className="text-sm font-semibold">Quick Actions</Label>
        </div>
        <p className="text-xs text-muted-foreground">Toggle which quick action cards appear on the customer homepage</p>
      </div>
      {actions.map((action) => (
        <div key={action.key} className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-primary/90">
              <action.icon className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-medium text-sm">{action.label}</span>
          </div>
          <Switch
            checked={config[action.key] !== false}
            onCheckedChange={(checked) => handleToggle(action.key, checked)}
          />
        </div>
      ))}
    </div>
  );
}
