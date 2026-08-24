import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const ACTIVE_BRANCH_COUNT_QUERY_KEY = ['active-branch-count'] as const;

export function useActiveBranchCount() {
  return useQuery({
    queryKey: ACTIVE_BRANCH_COUNT_QUERY_KEY,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('branches')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 5 * 60 * 1000,
  });
}