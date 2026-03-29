import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { QUERY_KEYS } from '@/constants';
import { 
  getDefaultBranding, 
  applyThemeColors, 
  applyThemeTypography, 
  applyThemeGradients,
  applyTemplateStyle,
  setupThemeObserver
} from '@/lib/theme';
import { setGlobalCurrency } from '@/lib/currency';
import type { Branding } from '@/types';

export const useBranding = () => {
  const { data: branding, isLoading, isError } = useQuery<Branding>({
    queryKey: [QUERY_KEYS.TENANT_BRANDING],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('*')
        .maybeSingle();
      
      if (!data) return getDefaultBranding();
      if (error) throw error;
      return data as Branding;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (branding) {
      // Sync global currency so formatCurrency() uses admin-configured currency everywhere
      setGlobalCurrency(branding.currency || 'USD');
      
      applyThemeColors(branding);
      applyThemeTypography(branding);
      applyThemeGradients(branding);
      applyTemplateStyle(branding);
      
      // Cache branding to localStorage for instant load on next visit
      try {
        localStorage.setItem('cached-branding', JSON.stringify({
          primary_color: branding.primary_color,
          secondary_color: branding.secondary_color,
          accent_color: branding.accent_color,
          background_color: branding.background_color,
          font_family: branding.font_family,
        }));
      } catch {}
      
      // Setup observer to handle theme changes
      const cleanup = setupThemeObserver(branding);
      
      return cleanup;
    }
  }, [branding]);

  return { branding, isLoading, isError };
};
