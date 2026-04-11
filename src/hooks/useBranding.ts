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

/**
 * Try to get cached branding from localStorage.
 * Returns null if no valid cache exists.
 */
const getCachedBranding = (): Branding | null => {
  try {
    const raw = localStorage.getItem('cached-branding-full');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Basic validity check — must have tenant_name from the DB
    if (parsed && parsed.tenant_name && parsed.id) {
      return parsed as Branding;
    }
    return null;
  } catch {
    return null;
  }
};

export const useBranding = () => {
  const cachedBranding = getCachedBranding();

  const { data: branding, isLoading, isError } = useQuery<Branding>({
    queryKey: [QUERY_KEYS.TENANT_BRANDING],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('*')
        .maybeSingle();
      
      if (error) throw error;
      // If no data in DB, return cached or default as last resort
      if (!data) return cachedBranding || getDefaultBranding();
      return data as Branding;
    },
    // Use cached branding as initial data so UI never shows template defaults
    initialData: cachedBranding || undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Always refetch to get fresh data
  });

  useEffect(() => {
    if (branding) {
      // Sync global currency so formatCurrency() uses admin-configured currency everywhere
      setGlobalCurrency(branding.currency || 'USD');
      
      applyThemeColors(branding);
      applyThemeTypography(branding);
      applyThemeGradients(branding);
      applyTemplateStyle(branding);
      
      // Cache full branding to localStorage for instant load on next visit
      try {
        localStorage.setItem('cached-branding-full', JSON.stringify(branding));
        // Also keep the quick-apply cache for the index.html inline script
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
