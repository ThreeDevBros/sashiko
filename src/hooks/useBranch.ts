import { useEffect, useRef, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  fetchBranchWithFallback, 
  getSavedBranchId, 
  saveBranchId, 
  calculateEstimatedTime 
} from '@/lib/branch';
import { supabase } from '@/integrations/supabase/client';
import { APP_CONFIG } from '@/constants';
import type { Branch } from '@/types';
import { subscribeToResume } from '@/lib/lifecycleManager';

/**
 * Geocode a branch address to get lat/lng when coordinates are missing.
 */
const geocodeBranchAddress = async (branch: Branch): Promise<Branch> => {
  if (branch.latitude && branch.longitude) return branch;
  if (!branch.address) return branch;

  try {
    const searchAddress = branch.city 
      ? `${branch.address}, ${branch.city}` 
      : branch.address;

    const { data, error } = await supabase.functions.invoke('geocode-location', {
      body: { address: searchAddress },
    });

    if (error || !data?.latitude || !data?.longitude) return branch;

    const updatedBranch = {
      ...branch,
      latitude: data.latitude,
      longitude: data.longitude,
    };

    supabase
      .from('branches')
      .update({ latitude: data.latitude, longitude: data.longitude })
      .eq('id', branch.id)
      .then(({ error: updateErr }) => {
        if (updateErr) console.warn('Could not persist branch coordinates:', updateErr);
      });

    return updatedBranch;
  } catch (err) {
    console.warn('Failed to geocode branch address:', err);
    return branch;
  }
};

const BRANCH_QUERY_KEY = ['branch-data'];

export const useBranch = () => {
  const queryClient = useQueryClient();
  const instanceId = useRef(Math.random().toString(36).slice(2, 8));

  const { data: branchData, isLoading: loading, isError: error } = useQuery({
    queryKey: BRANCH_QUERY_KEY,
    queryFn: async () => {
      const savedBranchId = getSavedBranchId();
      console.log('[useBranch] Resolving branch, saved ID:', savedBranchId);
      
      let data = await fetchBranchWithFallback(savedBranchId);
      
      if (!data) {
        throw new Error('No branch data available');
      }
      
      console.log('[useBranch] Branch resolved:', data.id, data.name);
      
      // Geocode if needed
      data = await geocodeBranchAddress(data);
      
      // Always persist the valid branch ID
      saveBranchId(data.id);
      
      const time = await calculateEstimatedTime();
      
      return { branch: data, estimatedTime: time };
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Resume counter to force realtime reconnect after backgrounding
  const [resumeCounter, setResumeCounter] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToResume(() => {
      setResumeCounter(prev => prev + 1);
    });

    return unsubscribe;
  }, []);

  // Listen for branch changes (user switching branches)
  useEffect(() => {
    const handleBranchChange = () => {
      queryClient.invalidateQueries({ queryKey: BRANCH_QUERY_KEY });
    };
    window.addEventListener('branchChanged', handleBranchChange);
    return () => window.removeEventListener('branchChanged', handleBranchChange);
  }, [queryClient]);

  // Real-time subscription for branch updates (pause status, etc.) — reconnects on resume
  const branchId = branchData?.branch?.id;
  useEffect(() => {
    if (!branchId) return;

    const channel = supabase
      .channel(`branch-realtime-${branchId}-${instanceId.current}-${resumeCounter}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'branches',
          filter: `id=eq.${branchId}`,
        },
        (payload) => {
          queryClient.setQueryData(BRANCH_QUERY_KEY, (old: any) => {
            if (!old) return old;
            return { ...old, branch: { ...old.branch, ...payload.new } as Branch };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [branchId, queryClient, resumeCounter]);

  // Update estimated time every minute
  useEffect(() => {
    const interval = setInterval(async () => {
      const time = await calculateEstimatedTime();
      queryClient.setQueryData(BRANCH_QUERY_KEY, (old: any) => {
        if (!old) return old;
        return { ...old, estimatedTime: time };
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [queryClient]);

  return { 
    branch: branchData?.branch ?? null, 
    estimatedTime: branchData?.estimatedTime ?? APP_CONFIG.ESTIMATED_TIME_BASE, 
    loading,
    error,
  };
};
