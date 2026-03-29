import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * SECURITY NOTE: This hook checks user roles for UI navigation purposes only.
 * 
 * ⚠️ CLIENT-SIDE CHECKS DO NOT PROVIDE SECURITY ⚠️
 * 
 * All data access is protected by Row-Level Security (RLS) policies in the database.
 * Even if an attacker bypasses this UI check, they cannot access protected data
 * unless they have proper roles verified server-side via the has_role() function.
 * 
 * When adding new admin features:
 * 1. ALWAYS add corresponding RLS policies using has_role()
 * 2. Never rely on client-side role checks for security
 * 3. Test RLS policies thoroughly
 */

type AppRole = 'admin' | 'manager' | 'staff' | 'delivery' | 'user';

export const useAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        setUserRole(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'manager', 'staff', 'delivery']);

      if (error) {
        // Don't log sensitive error details to console
        setIsAdmin(false);
        setUserRole(null);
      } else if (data && data.length > 0) {
        const roles = data.map(d => d.role);
        setIsAdmin(roles.includes('admin'));
        setUserRole(roles.includes('admin') ? 'admin' : roles[0] as AppRole);
      } else {
        setIsAdmin(false);
        setUserRole(null);
      }
    } catch (error) {
      // Don't log sensitive error details to console
      setIsAdmin(false);
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  };

  return { isAdmin, userRole, loading, hasRole: (role: AppRole) => userRole === role };
};
