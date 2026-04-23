import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  USER_ROLES_QUERY_KEY,
  USER_PERMISSIONS_QUERY_KEY,
  fetchUserRoles,
  fetchUserPermissions,
} from '@/lib/profilePrefetch';

export const usePermissions = () => {
  const { user, isAuthReady } = useAuth();

  const { data: userRoles = [], isLoading: rolesLoading } = useQuery({
    queryKey: user ? USER_ROLES_QUERY_KEY(user.id) : ['user-roles', 'none'],
    queryFn: () => fetchUserRoles(user!.id),
    enabled: !!user && isAuthReady,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const isAdmin = userRoles.includes('admin');
  const hasStaffRole =
    isAdmin || userRoles.some(r => ['manager', 'staff', 'delivery'].includes(r));

  const { data: permissionsData = [], isLoading: permsLoading } = useQuery({
    queryKey: user ? USER_PERMISSIONS_QUERY_KEY(user.id) : ['user-permissions', 'none'],
    queryFn: () => fetchUserPermissions(user!.id),
    enabled: !!user && isAuthReady && !isAdmin,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const permissions = isAdmin ? ['all'] : permissionsData;

  const loading =
    !isAuthReady || (!!user && (rolesLoading || (!isAdmin && permsLoading)));

  const hasPermission = (permission: string) => {
    if (isAdmin) return true;
    return permissions.includes('all') || permissions.includes(permission);
  };

  return { permissions, loading, hasPermission, isAdmin, hasStaffRole, userRoles };
};
