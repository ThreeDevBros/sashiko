import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

/**
 * Determines the correct home route based on user roles.
 * Staff-only users → /staff, Drivers → /driver, Admins → / (full access)
 */
export const getRoleBasedRoute = (roles: string[]): string => {
  // Admins and managers get full access
  if (roles.includes('admin') || roles.includes('manager') || roles.includes('branch_manager')) {
    return '/';
  }
  // Delivery drivers go to driver panel
  if (roles.includes('delivery')) {
    return '/driver';
  }
  // Staff go to staff panel
  if (roles.includes('staff')) {
    return '/staff';
  }
  // Regular users
  return '/';
};

/**
 * Returns true if the user with the given roles is allowed on the given path.
 */
export const isRouteAllowedForRoles = (path: string, roles: string[]): boolean => {
  // Admins/managers have full access
  if (roles.includes('admin') || roles.includes('manager') || roles.includes('branch_manager')) {
    return true;
  }
  // Regular users (no special roles) have full customer access
  if (roles.length === 0 || (roles.length === 1 && roles.includes('user'))) {
    return true;
  }
  // Staff-only users can only access /staff/*, /auth
  if (roles.includes('staff') && !roles.includes('admin') && !roles.includes('manager') && !roles.includes('branch_manager')) {
    return path === '/auth' || path.startsWith('/staff');
  }
  // Delivery-only users can only access /driver/*, /driver-dashboard, /auth
  if (roles.includes('delivery') && !roles.includes('admin') && !roles.includes('manager') && !roles.includes('branch_manager')) {
    return path === '/auth' || path.startsWith('/driver');
  }
  return true;
};

/**
 * Hook that fetches user roles and returns the appropriate redirect route.
 */
export const useRoleRedirect = () => {
  const [roles, setRoles] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRoles = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setRoles(null);
        setLoading(false);
        return;
      }
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id);
      
      setRoles(roleData?.map(r => r.role) || []);
    } catch {
      setRoles(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  return { roles, loading, fetchRoles };
};
