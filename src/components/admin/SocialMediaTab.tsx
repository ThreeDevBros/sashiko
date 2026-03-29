import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Upload, Facebook, Instagram, Youtube, Linkedin, MessageCircle } from 'lucide-react';
import { FaTiktok, FaSnapchat, FaThreads, FaPinterestP, FaWhatsapp, FaTelegram, FaXTwitter } from 'react-icons/fa6';

const PLATFORMS = [
  { id: 'facebook', name: 'Facebook', icon: Facebook },
  { id: 'instagram', name: 'Instagram', icon: Instagram },
  { id: 'x', name: 'X', icon: FaXTwitter },
  { id: 'tiktok', name: 'TikTok', icon: FaTiktok },
  { id: 'youtube', name: 'YouTube', icon: Youtube },
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin },
  { id: 'snapchat', name: 'Snapchat', icon: FaSnapchat },
  { id: 'threads', name: 'Threads', icon: FaThreads },
  { id: 'pinterest', name: 'Pinterest', icon: FaPinterestP },
  { id: 'whatsapp', name: 'WhatsApp', icon: FaWhatsapp },
  { id: 'telegram', name: 'Telegram', icon: FaTelegram },
  { id: 'other', name: 'Other Social Media', icon: MessageCircle },
];

const getPlatformIcon = (platformId: string) => {
  const platform = PLATFORMS.find(p => p.id === platformId);
  return platform?.icon || MessageCircle;
};

const getPlatformName = (platformId: string) => {
  const platform = PLATFORMS.find(p => p.id === platformId);
  return platform?.name || platformId;
};

interface SocialMediaLink {
  id: string;
  platform: string;
  custom_name: string | null;
  url: string;
  logo_url: string | null;
  is_visible: boolean;
  display_order: number;
}

export const SocialMediaTab = () => {
  const queryClient = useQueryClient();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { data: visibilitySettings } = useQuery({
    queryKey: ['social-media-visibility'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('tenant_settings') as any)
        .select('show_social_on_home, show_social_on_profile')
        .maybeSingle();
      if (error) throw error;
      return data as { show_social_on_home: boolean; show_social_on_profile: boolean } | null;
    },
  });

  const visibilityMutation = useMutation({
    mutationFn: async (updates: { show_social_on_home?: boolean; show_social_on_profile?: boolean }) => {
      const { data: settings } = await supabase
        .from('tenant_settings')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (!settings) throw new Error('No tenant settings found');
      const { error } = await (supabase
        .from('tenant_settings') as any)
        .update(updates)
        .eq('id', settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-media-visibility'] });
      toast.success('Visibility updated');
    },
    onError: () => toast.error('Failed to update visibility'),
  });

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['social-media-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_media_links')
        .select('*')
        .order('display_order');
      if (error) throw error;
      return data as SocialMediaLink[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (platform: string) => {
      const { error } = await supabase.from('social_media_links').insert({
        platform,
        display_order: links.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-media-links'] });
      toast.success('Social media link added');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SocialMediaLink> & { id: string }) => {
      const { error } = await supabase.from('social_media_links').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['social-media-links'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('social_media_links').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-media-links'] });
      toast.success('Social media link removed');
    },
  });

  const handleLogoUpload = async (id: string, file: File) => {
    const fileExt = file.name.split('.').pop();
    const filePath = `social-media/${id}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from('restaurant-images')
      .upload(filePath, file, { upsert: true });
    if (uploadError) {
      toast.error('Failed to upload logo');
      return;
    }
    const { data: urlData } = supabase.storage.from('restaurant-images').getPublicUrl(filePath);
    updateMutation.mutate({ id, logo_url: urlData.publicUrl });
    toast.success('Logo uploaded');
  };

  const handleAddPlatform = (platformId: string) => {
    addMutation.mutate(platformId);
    setPopoverOpen(false);
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-4">
        <Label className="text-sm font-semibold">Visible on:</Label>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground">Bottom of Homepage</Label>
            <Switch
              checked={visibilitySettings?.show_social_on_home ?? false}
              onCheckedChange={(checked) => visibilityMutation.mutate({ show_social_on_home: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground">Bottom of User Profile</Label>
            <Switch
              checked={visibilitySettings?.show_social_on_profile ?? false}
              onCheckedChange={(checked) => visibilityMutation.mutate({ show_social_on_profile: checked })}
            />
          </div>
        </div>
      </Card>

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button size="lg">
            <Plus className="w-4 h-4 mr-2" />
            Add Social Media Link
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="grid gap-1 max-h-80 overflow-y-auto">
            {PLATFORMS.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  onClick={() => handleAddPlatform(p.id)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm hover:bg-muted transition-colors text-left"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      <div className="space-y-4">
        {links.map((link) => {
          const Icon = getPlatformIcon(link.platform);
          const isOther = link.platform === 'other';
          return (
            <Card key={link.id} className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isOther && link.logo_url ? (
                    <img src={link.logo_url} alt="" className="w-5 h-5 rounded object-contain" />
                  ) : (
                    <Icon className="w-5 h-5 text-primary" />
                  )}
                  <span className="font-semibold text-sm">
                    {isOther ? (link.custom_name || 'Other Social Media') : getPlatformName(link.platform)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(link.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {isOther && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Custom Name</Label>
                  <Input
                    placeholder="e.g. Mastodon"
                    defaultValue={link.custom_name || ''}
                    onBlur={(e) => updateMutation.mutate({ id: link.id, custom_name: e.target.value })}
                  />
                </div>
              )}

              {isOther && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Custom Logo</Label>
                  <div className="flex items-center gap-3">
                    {link.logo_url && (
                      <img src={link.logo_url} alt="" className="w-8 h-8 rounded object-contain border" />
                    )}
                    <label className="cursor-pointer">
                      <Button variant="outline" size="sm" asChild>
                        <span>
                          <Upload className="w-3.5 h-3.5 mr-1.5" />
                          Upload
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleLogoUpload(link.id, file);
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Profile Link</Label>
                <Input
                  placeholder="https://..."
                  defaultValue={link.url}
                  onBlur={(e) => updateMutation.mutate({ id: link.id, url: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <Label className="text-xs text-muted-foreground">Show this Social Media on Page</Label>
                <Switch
                  checked={link.is_visible}
                  onCheckedChange={(checked) => updateMutation.mutate({ id: link.id, is_visible: checked })}
                />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
