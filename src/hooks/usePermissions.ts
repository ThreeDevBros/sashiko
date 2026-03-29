import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const usePermissions = () => {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasStaffRole, setHasStaffRole] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPermissions([]);
        setIsAdmin(false);
        setHasStaffRole(false);
        setUserRoles([]);
        setLoading(false);
        return;
      }

      // Check if user is admin - fetch ALL roles for the user
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const roles = roleData?.map(r => r.role) || [];
      setUserRoles(roles);

      // Check if any of the roles is 'admin'
      const hasAdminRole = roles.includes('admin');
      setIsAdmin(hasAdminRole);

      // Check if user has any staff role (manager, staff, delivery)
      const isStaff = roles.some(r => ['manager', 'staff', 'delivery'].includes(r));
      setHasStaffRole(isStaff || hasAdminRole);

      if (hasAdminRole) {
        // Admins have all permissions
        setPermissions(['all']);
        setLoading(false);
        return;
      }

      // Fetch user permissions for non-admins
      const { data: permsData } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', user.id);

      setPermissions(permsData?.map(p => p.permission) || []);
    } catch (error) {
      setPermissions([]);
      setIsAdmin(false);
      setHasStaffRole(false);
      setUserRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permission: string) => {
    // Admins always have all permissions
    if (isAdmin) return true;
    return permissions.includes('all') || permissions.includes(permission);
  };

  return { permissions, loading, hasPermission, isAdmin, hasStaffRole, userRoles };
};
