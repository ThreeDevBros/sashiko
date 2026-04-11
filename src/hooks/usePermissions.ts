import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const usePermissions = () => {
  const { user, isAuthReady } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasStaffRole, setHasStaffRole] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    if (!isAuthReady) return;

    if (!user) {
      setPermissions([]);
      setIsAdmin(false);
      setHasStaffRole(false);
      setUserRoles([]);
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      try {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        const roles = roleData?.map(r => r.role) || [];
        setUserRoles(roles);

        const hasAdminRole = roles.includes('admin');
        setIsAdmin(hasAdminRole);

        const isStaff = roles.some(r => ['manager', 'staff', 'delivery'].includes(r));
        setHasStaffRole(isStaff || hasAdminRole);

        if (hasAdminRole) {
          setPermissions(['all']);
          setLoading(false);
          return;
        }

        const { data: permsData } = await supabase
          .from('user_permissions')
          .select('permission')
          .eq('user_id', user.id);

        setPermissions(permsData?.map(p => p.permission) || []);
      } catch {
        setPermissions([]);
        setIsAdmin(false);
        setHasStaffRole(false);
        setUserRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [user, isAuthReady]);

  const hasPermission = (permission: string) => {
    if (isAdmin) return true;
    return permissions.includes('all') || permissions.includes(permission);
  };

  return { permissions, loading, hasPermission, isAdmin, hasStaffRole, userRoles };
};
