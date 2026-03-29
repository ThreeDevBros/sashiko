import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Facebook, Instagram, Youtube, Linkedin, MessageCircle } from 'lucide-react';
import { FaTiktok, FaSnapchat, FaThreads, FaPinterestP, FaWhatsapp, FaTelegram, FaXTwitter } from 'react-icons/fa6';

const PLATFORM_ICONS: Record<string, any> = {
  facebook: Facebook,
  instagram: Instagram,
  x: FaXTwitter,
  tiktok: FaTiktok,
  youtube: Youtube,
  linkedin: Linkedin,
  snapchat: FaSnapchat,
  threads: FaThreads,
  pinterest: FaPinterestP,
  whatsapp: FaWhatsapp,
  telegram: FaTelegram,
};

interface SocialMediaSectionProps {
  page: 'home' | 'profile';
}

export const SocialMediaSection = ({ page }: SocialMediaSectionProps) => {
  const { data: settings } = useQuery({
    queryKey: ['tenant-social-visibility'],
    queryFn: async () => {
      const { data } = await (supabase
        .from('tenant_settings') as any)
        .select('show_social_on_home, show_social_on_profile')
        .maybeSingle();
      return data as { show_social_on_home: boolean; show_social_on_profile: boolean } | null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const isEnabled = page === 'home' ? settings?.show_social_on_home : settings?.show_social_on_profile;

  const { data: links = [] } = useQuery({
    queryKey: ['social-media-links-public'],
    queryFn: async () => {
      const { data } = await supabase
        .from('social_media_links')
        .select('*')
        .eq('is_visible', true)
        .order('display_order');
      return (data || []).filter((l: any) => l.url && l.url.trim() !== '');
    },
    enabled: !!isEnabled,
    staleTime: 5 * 60 * 1000,
  });

  if (!isEnabled || links.length === 0) return null;

  return (
    <div className="py-8 px-4">
      <div className="max-w-7xl mx-auto text-center space-y-4">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Visit us on
        </p>
        <div className="flex items-center justify-center gap-6">
          {links.map((link: any) => {
            const Icon = PLATFORM_ICONS[link.platform] || MessageCircle;
            const isOther = link.platform === 'other';
            const label = isOther ? (link.custom_name || 'Social Media') : link.platform.charAt(0).toUpperCase() + link.platform.slice(1);
            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="text-muted-foreground hover:text-primary transition-colors duration-200 hover:scale-110 active:scale-95"
              >
                {isOther && link.logo_url ? (
                  <img src={link.logo_url} alt={label} className="w-7 h-7 object-contain" />
                ) : (
                  <Icon className="w-7 h-7" />
                )}
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
};
