import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type AppRole = 'admin' | 'manager' | 'staff' | 'delivery' | 'user';

export const useAdmin = () => {
  const { user, isAuthReady } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthReady) return;

    if (!user) {
      setIsAdmin(false);
      setUserRole(null);
      setLoading(false);
      return;
    }

    const checkAdminStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['admin', 'manager', 'staff', 'delivery']);

        if (error) {
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
      } catch {
        setIsAdmin(false);
        setUserRole(null);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [user, isAuthReady]);

  return { isAdmin, userRole, loading, hasRole: (role: AppRole) => userRole === role };
};
