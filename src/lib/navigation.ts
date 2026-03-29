// Centralized navigation configuration for back button destinations
// Maps current route patterns to their parent/back destinations

type NavigationMap = Record<string, string>;

const backNavigationMap: NavigationMap = {
  // Customer routes
  '/order': '/',
  '/cart': '/order',
  '/checkout': '/cart',
  '/profile': '/',
  '/address': '/profile',
  '/order-history': '/profile',
  '/reservation-history': '/profile',
  '/table-booking': '/',
  '/auth': '/',
  '/checkout-success': '/',
  '/book-table': '/',
  '/driver-dashboard': '/',
  '/legal/terms': '/',
  '/legal/privacy': '/',
  
  // Admin routes
  '/admin': '/',
  '/admin/menu': '/admin',
  '/admin/branches': '/admin',
  '/admin/customise': '/admin',
  '/admin/coupons': '/admin',
  '/admin/orders': '/admin',
  '/admin/reservations': '/admin',
  '/admin/users': '/admin',
  '/admin/customers': '/admin',
  '/admin/configure': '/admin',
  '/admin/broadcast': '/admin',
  '/admin/social-media': '/admin',
  '/admin/staff': '/admin',
  '/admin/statistics': '/admin',
  '/admin/reports': '/admin',
  '/staff': '/',
  '/staff/reservations': '/staff',
  '/staff/history': '/staff',
  '/staff/report': '/staff',
};

/**
 * Gets the back navigation destination for a given path
 * Falls back to '/' if no specific mapping exists
 */
export function getBackDestination(currentPath: string, referrer?: string): string {
  // Order tracking: go back to referrer if it was order-history, otherwise home
  if (currentPath.startsWith('/order-tracking')) {
    if (referrer && referrer.startsWith('/order-history')) return '/order-history';
    return '/';
  }

  // First check for exact match
  if (backNavigationMap[currentPath]) {
    return backNavigationMap[currentPath];
  }
  
  // Check for dynamic routes (e.g., /order-tracking/123)
  for (const [pattern, destination] of Object.entries(backNavigationMap)) {
    if (currentPath.startsWith(pattern + '/')) {
      return destination;
    }
  }
  
  // Default fallback
  return '/';
}
