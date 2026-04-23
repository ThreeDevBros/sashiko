import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const STALE_TIME = 5 * 60 * 1000;

export const PROFILE_QUERY_KEY = (userId: string) => ['profile', userId];
export const USER_ROLES_QUERY_KEY = (userId: string) => ['user-roles', userId];
export const USER_PERMISSIONS_QUERY_KEY = (userId: string) => ['user-permissions', userId];

export const fetchProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const fetchUserRoles = async (userId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);
  if (error) throw error;
  return data?.map((r: any) => r.role as string) || [];
};

export const fetchUserPermissions = async (userId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from('user_permissions')
    .select('permission')
    .eq('user_id', userId);
  if (error) throw error;
  return data?.map((p: any) => p.permission as string) || [];
};

export const prefetchProfile = (qc: QueryClient, userId: string) => {
  if (!userId) return;
  void qc.prefetchQuery({
    queryKey: PROFILE_QUERY_KEY(userId),
    queryFn: () => fetchProfile(userId),
    staleTime: STALE_TIME,
  });
};

export const prefetchUserRoles = (qc: QueryClient, userId: string) => {
  if (!userId) return;
  void qc.prefetchQuery({
    queryKey: USER_ROLES_QUERY_KEY(userId),
    queryFn: () => fetchUserRoles(userId),
    staleTime: STALE_TIME,
  });
};

export const prefetchUserPermissions = (qc: QueryClient, userId: string) => {
  if (!userId) return;
  void qc.prefetchQuery({
    queryKey: USER_PERMISSIONS_QUERY_KEY(userId),
    queryFn: () => fetchUserPermissions(userId),
    staleTime: STALE_TIME,
  });
};
