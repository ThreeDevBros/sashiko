import { THEME_DEFAULTS } from '@/constants';
import type { Branding, TemplateStyle } from '@/types';

/**
 * Convert hex color to HSL format
 */
export const hexToHSL = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '18 88% 55%';
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

/**
 * Apply theme colors to CSS variables
 * CRITICAL: Respects dark mode - only applies branding to accent colors, not structural colors
 */
export const applyThemeColors = (branding: Branding | null): void => {
  if (!branding) return;
  
  const root = document.documentElement;
  const isDarkMode = root.classList.contains('dark') || root.classList.contains('dark-grey');

  // Always apply accent colors (primary, secondary, accent) from branding
  if (branding.primary_color) {
    root.style.setProperty('--primary', hexToHSL(branding.primary_color));
    root.style.setProperty('--ring', hexToHSL(branding.primary_color));
  }
  if (branding.secondary_color) {
    root.style.setProperty('--secondary', hexToHSL(branding.secondary_color));
  }
  if (branding.accent_color) {
    root.style.setProperty('--accent', hexToHSL(branding.accent_color));
  }
  
  // Handle background based on current theme
  if (isDarkMode) {
    // In dark modes, REMOVE any inline background style so CSS variables take over
    root.style.removeProperty('--background');
  } else if (branding.background_color) {
    // In light mode, apply branding background
    root.style.setProperty('--background', hexToHSL(branding.background_color));
  }
};

/**
 * Setup theme change observer to handle background properly
 */
export const setupThemeObserver = (branding: Branding | null): (() => void) => {
  const root = document.documentElement;
  
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        const isDarkMode = root.classList.contains('dark') || root.classList.contains('dark-grey');
        if (isDarkMode) {
          // Clear inline background in dark modes
          root.style.removeProperty('--background');
        } else if (branding?.background_color) {
          // Restore branding background in light mode
          root.style.setProperty('--background', hexToHSL(branding.background_color));
        }
      }
    });
  });
  
  observer.observe(root, { attributes: true, attributeFilter: ['class'] });
  
  // Return cleanup function
  return () => observer.disconnect();
};

/**
 * Apply theme typography to document
 */
export const applyThemeTypography = (branding: Branding | null): void => {
  if (!branding) return;
  
  const root = document.documentElement;

  // Load Google Font dynamically
  if (branding.font_family) {
    const existingLink = document.querySelector(`link[href*="${branding.font_family.replace(' ', '+')}"]`);
    if (!existingLink) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${branding.font_family.replace(' ', '+')}:wght@400;500;600;700&display=swap`;
      document.head.appendChild(link);
    }
    
    root.style.setProperty('--font-family', branding.font_family);
    document.body.style.fontFamily = branding.font_family;
  }
  
  if (branding.font_size_base) {
    root.style.setProperty('--font-size-base', branding.font_size_base);
    document.body.style.fontSize = branding.font_size_base;
  }
  
  if (branding.font_size_heading) {
    root.style.setProperty('--font-size-heading', branding.font_size_heading);
  }
};

/**
 * Apply theme gradients
 */
export const applyThemeGradients = (branding: Branding | null): void => {
  if (!branding) return;
  
  const root = document.documentElement;

  if (branding.gradient_primary) {
    root.style.setProperty('--gradient-primary', branding.gradient_primary);
  }
  if (branding.gradient_secondary) {
    root.style.setProperty('--gradient-secondary', branding.gradient_secondary);
  }
};

/**
 * Apply template style attribute
 */
export const applyTemplateStyle = (branding: Branding | null): void => {
  if (!branding?.template_style) return;
  document.documentElement.setAttribute('data-template', branding.template_style);
};

/**
 * Get CSS classes for card based on template style
 */
export const getCardClass = (templateStyle?: string | null): string => {
  switch (templateStyle) {
    case 'classic':
      return 'rounded-2xl backdrop-blur-xl bg-white/70 border border-white/30 shadow-[0_8px_16px_0_rgba(31,38,135,0.1)]';
    case 'minimal':
      return 'rounded-none bg-white shadow-none border border-gray-200';
    case 'bold':
      return 'rounded-xl bg-gradient-to-br from-white to-gray-50 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.3)] border-2 border-gray-300';
    default:
      return 'rounded-lg backdrop-blur-xl bg-white/80 border border-white/20 shadow-lg';
  }
};

/**
 * Get CSS classes for button based on template style
 */
export const getButtonClass = (templateStyle?: string | null): string => {
  switch (templateStyle) {
    case 'classic':
      return 'rounded-full';
    case 'minimal':
      return 'rounded-none border-2';
    case 'bold':
      return 'rounded-lg shadow-xl';
    default:
      return 'rounded-md';
  }
};

/**
 * Get default branding configuration
 */
export const getDefaultBranding = (): Branding => ({
  id: '',
  tenant_name: 'Sashiko Asian Fusion',
  hero_title: 'Welcome to Sashiko',
  hero_subtitle: 'Experience the finest dining',
  primary_color: THEME_DEFAULTS.PRIMARY_COLOR,
  secondary_color: THEME_DEFAULTS.SECONDARY_COLOR,
  accent_color: THEME_DEFAULTS.ACCENT_COLOR,
  background_color: THEME_DEFAULTS.BACKGROUND_COLOR,
  font_family: THEME_DEFAULTS.FONT_FAMILY,
  font_size_base: THEME_DEFAULTS.FONT_SIZE_BASE,
  font_size_heading: THEME_DEFAULTS.FONT_SIZE_HEADING,
  gradient_primary: THEME_DEFAULTS.GRADIENT_PRIMARY,
  gradient_secondary: THEME_DEFAULTS.GRADIENT_SECONDARY,
  template_style: THEME_DEFAULTS.TEMPLATE_STYLE,
  login_bg_color: '#f97316',
  login_logo_url: null,
  logo_url: null,
  loading_screen_image: null,
  home_image_url: null,
  menu_display_style: 'grid',
  currency: 'USD',
  cta_button_text: 'Order Now',
  footer_text: '© 2025 All rights reserved',
  language: 'en',
  timezone: 'UTC',
  vat_number: null,
  vat_rate: 0,
  banner_style: 'single',
  banner_data: [],
  slideshow_interval_seconds: 7,
  popular_section_title: 'Popular Items',
  popular_section_description: 'Customer favorites',
  popular_item_ids: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});
