// Centralized type definitions

export interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  opens_at: string;
  closes_at: string;
  latitude: number | null;
  longitude: number | null;
  delivery_radius_km: number | null;
  is_active?: boolean;
  is_paused?: boolean;
  is_reservations_paused?: boolean;
  description?: string | null;
  google_maps_rating?: number | null;
  google_maps_place_id?: string | null;
  google_maps_review_count?: number | null;
}

export interface BranchHours {
  id?: string;
  branch_id?: string;
  day_of_week: number; // 0=Monday, 6=Sunday
  is_closed: boolean;
  is_24h: boolean;
  open_time: string | null;
  close_time: string | null;
  delivery_open_time: string | null;
  delivery_close_time: string | null;
  delivery_enabled: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_featured: boolean;
  is_vegetarian: boolean;
  is_vegan: boolean;
  calories: number | null;
  category_id: string | null;
  is_available?: boolean;
  branch_availability?: boolean;
  tax_rate?: number | null;
  tax_included_in_price?: boolean;
  category?: {
    name: string;
  };
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  image_url: string | null;
  is_active: boolean;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string | null;
  special_instructions?: string;
  tax_rate?: number | null;
  tax_included_in_price?: boolean;
}

export interface Branding {
  id: string;
  tenant_name: string;
  logo_url: string | null;
  loading_screen_image: string | null;
  home_image_url: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  cta_button_text: string | null;
  footer_text: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  background_color: string | null;
  font_family: string | null;
  font_size_base: string | null;
  font_size_heading: string | null;
  gradient_primary: string | null;
  gradient_secondary: string | null;
  template_style: string | null;
  login_bg_color: string | null;
  login_logo_url: string | null;
  menu_display_style: string | null;
  currency: string | null;
  language: string | null;
  timezone: string | null;
  vat_number: string | null;
  vat_rate: number | null;
  banner_style: string;
  banner_data: any[];
  slideshow_interval_seconds: number;
  popular_section_title: string;
  popular_section_description: string;
  popular_item_ids: string[];
  created_at: string;
  updated_at: string;
}

export type TemplateStyle = 'modern' | 'classic' | 'minimal' | 'bold';

export interface UserAddress {
  id: string;
  user_id: string;
  label: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
}
