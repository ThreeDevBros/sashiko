import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { USER_ROLES_QUERY_KEY, fetchUserRoles } from '@/lib/profilePrefetch';

type AppRole = 'admin' | 'manager' | 'staff' | 'delivery' | 'user';

const STAFF_ROLES = ['admin', 'manager', 'staff', 'delivery'];

export const useAdmin = () => {
  const { user, isAuthReady } = useAuth();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: user ? USER_ROLES_QUERY_KEY(user.id) : ['user-roles', 'none'],
    queryFn: () => fetchUserRoles(user!.id),
    enabled: !!user && isAuthReady,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const staffRoles = roles.filter(r => STAFF_ROLES.includes(r));
  const isAdmin = staffRoles.includes('admin');
  const userRole: AppRole | null = !user
    ? null
    : isAdmin
      ? 'admin'
      : (staffRoles[0] as AppRole) || null;

  const loading = !isAuthReady || (!!user && isLoading);

  return {
    isAdmin,
    userRole,
    loading,
    hasRole: (role: AppRole) => userRole === role,
  };
};
