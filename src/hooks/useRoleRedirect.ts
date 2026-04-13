import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Determines the correct home route based on user roles.
 * Staff-only users → /staff, Drivers → /driver, Admins → / (full access)
 */
export const getRoleBasedRoute = (roles: string[]): string => {
  if (roles.includes('admin') || roles.includes('manager') || roles.includes('branch_manager')) {
    return '/';
  }
  if (roles.includes('delivery')) {
    return '/driver';
  }
  if (roles.includes('staff')) {
    return '/staff';
  }
  return '/';
};

/**
 * Returns true if the user with the given roles is allowed on the given path.
 */
export const isRouteAllowedForRoles = (path: string, roles: string[]): boolean => {
  if (roles.includes('admin') || roles.includes('manager') || roles.includes('branch_manager')) {
    return true;
  }
  if (roles.length === 0 || (roles.length === 1 && roles.includes('user'))) {
    return true;
  }
  if (roles.includes('staff') && !roles.includes('admin') && !roles.includes('manager') && !roles.includes('branch_manager')) {
    return path === '/auth' || path.startsWith('/staff');
  }
  if (roles.includes('delivery') && !roles.includes('admin') && !roles.includes('manager') && !roles.includes('branch_manager')) {
    return path === '/auth' || path.startsWith('/driver');
  }
  return true;
};

/**
 * Hook that fetches user roles and returns the appropriate redirect route.
 * Uses useAuth() context instead of direct getSession() to avoid race conditions.
 */
export const useRoleRedirect = () => {
  const { user, isAuthReady } = useAuth();
  const [roles, setRoles] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRoles = async () => {
    if (!user) {
      setRoles(null);
      setLoading(false);
      return;
    }
    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      setRoles(roleData?.map(r => r.role) || []);
    } catch {
      setRoles(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthReady) return;
    fetchRoles();
  }, [isAuthReady, user?.id]);

  return { roles, loading, fetchRoles };
};
