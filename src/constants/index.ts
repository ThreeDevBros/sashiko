// App-wide constants

export const APP_CONFIG = {
  DEFAULT_CURRENCY: 'USD',
  DEFAULT_RESTAURANT_NAME: 'Sashiko Asian Fusion',
  DEFAULT_HERO_TITLE: 'Welcome to Sashiko',
  DEFAULT_HERO_SUBTITLE: 'Experience the finest dining',
  ESTIMATED_TIME_BASE: 30,
  ESTIMATED_TIME_PER_ORDER: 5,
  ESTIMATED_TIME_MAX: 60,
} as const;

export const THEME_DEFAULTS = {
  PRIMARY_COLOR: '#f97316',
  SECONDARY_COLOR: '#fb923c',
  ACCENT_COLOR: '#fdba74',
  BACKGROUND_COLOR: '#ffffff',
  FONT_FAMILY: 'Inter',
  FONT_SIZE_BASE: '16px',
  FONT_SIZE_HEADING: '2.5rem',
  GRADIENT_PRIMARY: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
  GRADIENT_SECONDARY: 'linear-gradient(135deg, #fb923c 0%, #fdba74 100%)',
  TEMPLATE_STYLE: 'modern',
} as const;

export const ANIMATION_DELAYS = {
  TRANSITION_SHORT: 150,
  TRANSITION_MEDIUM: 300,
  TRANSITION_LONG: 500,
  STAGGER_ITEM: 50,
} as const;

export const STORAGE_KEYS = {
  SELECTED_BRANCH: 'selectedBranchId',
  CART_ITEMS: 'cart',
  USER_PREFERENCES: 'userPreferences',
  DELIVERY_ADDRESS: 'selectedDeliveryAddress',
  CURRENT_LOCATION_DATA: 'currentLocationData',
  LOCAL_DELIVERY_ADDRESSES: 'localDeliveryAddresses',
  SAVED_ADDRESS_DATA: 'savedAddressData',
  SELECTED_LOCATION_DATA: 'selectedLocationData',
} as const;

export const QUERY_KEYS = {
  BRANCHES: 'branches',
  MENU_CATEGORIES: 'menu-categories-public',
  MENU_ITEMS: 'branch-menu-items-public',
  TENANT_BRANDING: 'tenant-branding',
  USER_ADDRESSES: 'user-addresses',
} as const;
