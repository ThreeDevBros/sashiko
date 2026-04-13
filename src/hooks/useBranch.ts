import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  fetchBranchWithFallback, 
  getSavedBranchId, 
  saveBranchId, 
  calculateEstimatedTime 
} from '@/lib/branch';
import { APP_CONFIG } from '@/constants';
import type { Branch } from '@/types';

/**
 * Geocode a branch address to get lat/lng when coordinates are missing.
 * Fire-and-forget: updates query cache when done but doesn't block.
 */
const geocodeBranchAddressAsync = async (branch: Branch, queryClient: ReturnType<typeof useQueryClient>, queryKey: string[]) => {
  if (branch.latitude && branch.longitude) return;
  if (!branch.address) return;

  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const searchAddress = branch.city 
      ? `${branch.address}, ${branch.city}` 
      : branch.address;

    const { data, error } = await supabase.functions.invoke('geocode-location', {
      body: { address: searchAddress },
    });

    if (error || !data?.latitude || !data?.longitude) return;

    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old;
      return { ...old, branch: { ...old.branch, latitude: data.latitude, longitude: data.longitude } };
    });

    supabase
      .from('branches')
      .update({ latitude: data.latitude, longitude: data.longitude })
      .eq('id', branch.id)
      .then(({ error: updateErr }) => {
        if (updateErr) console.warn('Could not persist branch coordinates:', updateErr);
      });
  } catch (err) {
    console.warn('Failed to geocode branch address:', err);
  }
};

const BRANCH_QUERY_KEY = ['branch-data'];

/**
 * Lightweight hook — returns branch data from React Query cache.
 * All side effects (realtime, intervals, resume) live in BranchRealtimeManager.
 */
export const useBranch = () => {
  const queryClient = useQueryClient();

  const { data: branchData, isLoading: loading, isError: error } = useQuery({
    queryKey: BRANCH_QUERY_KEY,
    queryFn: async () => {
      const savedBranchId = getSavedBranchId();
      console.log('[useBranch] Resolving branch, saved ID:', savedBranchId);
      
      const data = await fetchBranchWithFallback(savedBranchId);
      
      if (!data) {
        throw new Error('No branch data available');
      }
      
      console.log('[useBranch] Branch resolved:', data.id, data.name);
      saveBranchId(data.id);
      
      return { branch: data, estimatedTime: APP_CONFIG.ESTIMATED_TIME_BASE };
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // After branch loads: geocode + estimated time in background (once)
  const branchId = branchData?.branch?.id;
  const hasGeocodedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!branchData?.branch || !branchId) return;

    if (hasGeocodedRef.current !== branchId) {
      hasGeocodedRef.current = branchId;
      geocodeBranchAddressAsync(branchData.branch, queryClient, BRANCH_QUERY_KEY);
    }

    // One-time estimated time fetch on branch load
    calculateEstimatedTime().then(time => {
      queryClient.setQueryData(BRANCH_QUERY_KEY, (old: any) => {
        if (!old) return old;
        return { ...old, estimatedTime: time };
      });
    }).catch(() => {});
  }, [branchId, branchData?.branch, queryClient]);

  // Listen for branch changes (user switching branches)
  useEffect(() => {
    const handleBranchChange = () => {
      queryClient.invalidateQueries({ queryKey: BRANCH_QUERY_KEY });
    };
    window.addEventListener('branchChanged', handleBranchChange);
    return () => window.removeEventListener('branchChanged', handleBranchChange);
  }, [queryClient]);

  return { 
    branch: branchData?.branch ?? null, 
    estimatedTime: branchData?.estimatedTime ?? APP_CONFIG.ESTIMATED_TIME_BASE, 
    loading,
    error,
  };
};
