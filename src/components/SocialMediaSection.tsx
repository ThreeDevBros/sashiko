import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Facebook, Instagram, Youtube, Linkedin, MessageCircle, Send } from 'lucide-react';

// Inline lightweight SVG icons to avoid importing 482KB react-icons/fa6 bundle
const FaXTwitter = (props: any) => <svg {...props} viewBox="0 0 512 512" fill="currentColor"><path d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8L200.7 275.5 26.8 48H172.4L272.9 180.9 389.2 48zM364.4 421.8h39.1L151.1 88h-42L364.4 421.8z"/></svg>;
const FaTiktok = (props: any) => <svg {...props} viewBox="0 0 448 512" fill="currentColor"><path d="M448 209.9a210.1 210.1 0 0 1-122.8-39.3V349.4A162.6 162.6 0 1 1 185 188.3V278.2a74.6 74.6 0 1 0 52.2 71.2V0h88a121 121 0 0 0 122.8 121v88.9z"/></svg>;
const FaSnapchat = (props: any) => <svg {...props} viewBox="0 0 512 512" fill="currentColor"><path d="M496.9 366.6c-3.4-9.2-14.7-15.1-33.6-17.6-2.7-.4-5.6-.7-8.6-1.1-11.4-1.4-24.3-3-35.2-8.6-3.4-1.8-6.2-3.9-8.5-6.4 2.9-7.7 7.4-15 13.1-22.3 14.4-18.4 33.3-31.2 33.3-31.2l-1.5-3.6c-6-14.2-20.3-22.8-38.3-22.8-6.4 0-12.5 1.2-17.9 3.4-.6-23.6-4.3-47.2-14.3-67.4C360.5 136 320.2 112 270.1 112h-28.2c-50.1 0-90.4 24-116.4 68-9.9 20.2-13.7 43.8-14.3 67.4-5.4-2.2-11.5-3.4-17.9-3.4-18 0-32.3 8.6-38.3 22.8l-1.5 3.6s18.9 12.8 33.3 31.2c5.7 7.3 10.2 14.6 13.1 22.3-2.3 2.5-5.1 4.6-8.5 6.4-10.9 5.6-23.8 7.2-35.2 8.6-3 .4-5.9.7-8.6 1.1-18.9 2.5-30.2 8.4-33.6 17.6-2.4 6.5-.5 14 5.6 22.3 10.1 13.8 27.4 21.8 33.8 24.5 1.7.7 2.8 1.2 3.2 1.5.7 2.6.7 5.3-.1 10.2-.3 1.7-.7 3.5-1.1 5.6-1.7 8.9-4.1 21 3.3 30.4 7.8 9.8 23 14.4 46.5 14 8.4-.2 17.5-1.3 27.5-2.5 12-1.4 25.6-3 40.1-2.5 8.2.3 16 1.9 23.4 4.9 11.7 4.8 21.8 13 32.6 21.7 16.5 13.3 35.2 28.4 63 28.4s46.5-15.1 63-28.4c10.8-8.7 20.9-16.9 32.6-21.7 7.4-3 15.2-4.6 23.4-4.9 14.5-.5 28.1 1.1 40.1 2.5 10 1.2 19.1 2.3 27.5 2.5 23.5.4 38.7-4.2 46.5-14 7.4-9.4 5-21.5 3.3-30.4-.4-2.1-.8-3.9-1.1-5.6-.8-4.9-.8-7.6-.1-10.2.4-.3 1.5-.8 3.2-1.5 6.4-2.7 23.7-10.7 33.8-24.5 6.1-8.3 8-15.8 5.6-22.3z"/></svg>;
const FaThreads = (props: any) => <svg {...props} viewBox="0 0 448 512" fill="currentColor"><path d="M331.5 235.7c2.2.9 4.2 1.9 6.3 2.8 29.2 14.1 50.6 35.2 61.8 61.4 15.7 36.9 17.6 95.2-30.4 143.1-36.7 36.6-83 52.1-138.8 52.1h-3.3c-70.4-.7-129-29.8-164.5-81.9l33.4-23.4c27.5 40.4 73.4 63.2 126.7 63.2h2.5c44.3-.4 79.3-12.3 103.8-35.5 28.1-26.5 33.8-62.7 22.3-89.7-8.2-19.3-23.4-34.2-44.1-43.5-9.3-4.2-19.3-7.2-29.8-9.1-7.9 58.8-39.2 93.2-79.2 111.1-28.8 12.9-64.1 17.5-95.7 8.2-37.2-10.9-60.1-38.5-63.7-76.1-2.7-28.3 6.5-56 27.9-75.9 28.3-26.4 69-33.7 113.4-22.4-3.6-20.3-8.2-37.7-14.3-52.1l37.7-6.6c6.8 16.4 11.9 35.5 15.7 57.7 10.8 1.1 21.5 3.6 31.7 7.5zM220.2 371c54.7 0 83.5-19.7 99.8-59.7-45.2-7.6-80.6-3.5-103.3 8.7-18.2 9.8-28.3 25.3-26.3 44.5 1.3 13.1 10.7 25.2 29.8 25.2v1.3z"/></svg>;
const FaPinterestP = (props: any) => <svg {...props} viewBox="0 0 384 512" fill="currentColor"><path d="M204 6.5C101.4 6.5 0 74.9 0 185.6 0 256 39.6 296 63.6 296c9.9 0 15.6-27.6 15.6-35.4 0-9.3-23.7-29.1-23.7-67.8 0-80.4 61.2-137.4 140.4-137.4 68.1 0 118.5 38.7 118.5 109.8 0 53.1-21.3 152.7-90.3 152.7-24.9 0-46.2-18-46.2-43.8 0-37.8 26.4-74.4 26.4-113.4 0-66.2-93.9-54.2-93.9 25.8 0 16.8 2.1 35.4 9.6 50.7-13.8 59.4-42 147.9-42 209.1 0 18.9 2.7 37.5 4.5 56.4 3.4 3.8 1.7 3.4 6.9 1.5 50.4-69 48.6-82.5 71.4-172.8 12.3 23.4 44.1 36 69.3 36 106.2 0 153.9-103.5 153.9-196.8C384 71.3 298.2 6.5 204 6.5z"/></svg>;
const FaWhatsapp = (props: any) => <svg {...props} viewBox="0 0 448 512" fill="currentColor"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>;
const FaTelegram = (props: any) => <svg {...props} viewBox="0 0 496 512" fill="currentColor"><path d="M248 8C111 8 0 119 0 256s111 248 248 248 248-111 248-248S385 8 248 8zm121.8 169.9l-40.7 191.8c-3 13.6-11.1 16.9-22.4 10.5l-62-45.7-29.9 28.8c-3.3 3.3-6.1 6.1-12.5 6.1l4.4-63.1 114.9-103.8c5-4.4-1.1-6.9-7.7-2.5l-142 89.4-61.2-19.1c-13.3-4.2-13.6-13.3 2.8-19.7l239.1-92.2c11.1-4 20.8 2.7 17.2 19.5z"/></svg>;

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
