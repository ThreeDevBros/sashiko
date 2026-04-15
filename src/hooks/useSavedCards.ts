import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

const fetchSavedCards = async (): Promise<SavedCard[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase.functions.invoke('get-saved-cards');
  if (error) {
    console.error('Error fetching saved cards:', error);
    return [];
  }
  return data?.cards || [];
};

export const useSavedCards = () => {
  const queryClient = useQueryClient();

  const { data: savedCards = [], isLoading, refetch } = useQuery({
    queryKey: ['saved-cards'],
    queryFn: fetchSavedCards,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  });

  const refreshCards = async () => {
    queryClient.removeQueries({ queryKey: ['saved-cards'] });
    await refetch();
  };

  return { savedCards, isLoading, refreshCards };
};

// Call this to prefetch at app startup
export const prefetchSavedCards = (queryClient: any) => {
  queryClient.prefetchQuery({
    queryKey: ['saved-cards'],
    queryFn: fetchSavedCards,
    staleTime: 5 * 60 * 1000,
  });
};
