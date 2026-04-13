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
 * Fire-and-forget: updates query cache when done but doesn't block.
 */
const geocodeBranchAddressAsync = (branch: Branch, queryClient: ReturnType<typeof useQueryClient>, queryKey: string[]) => {
  if (branch.latitude && branch.longitude) return;
  if (!branch.address) return;

  (async () => {
    try {
      const searchAddress = branch.city 
        ? `${branch.address}, ${branch.city}` 
        : branch.address;

      const { data, error } = await supabase.functions.invoke('geocode-location', {
        body: { address: searchAddress },
      });

      if (error || !data?.latitude || !data?.longitude) return;

      // Update cache with coordinates
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return { ...old, branch: { ...old.branch, latitude: data.latitude, longitude: data.longitude } };
      });

      // Persist to DB (fire-and-forget)
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
  })();
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
      
      const data = await fetchBranchWithFallback(savedBranchId);
      
      if (!data) {
        throw new Error('No branch data available');
      }
      
      console.log('[useBranch] Branch resolved:', data.id, data.name);
      
      // Always persist the valid branch ID
      saveBranchId(data.id);
      
      // Return immediately with base estimated time — don't block on extra queries
      return { branch: data, estimatedTime: APP_CONFIG.ESTIMATED_TIME_BASE };
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // After branch loads: geocode + estimated time in background (non-blocking)
  const branchId = branchData?.branch?.id;
  const hasGeocodedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!branchData?.branch || !branchId) return;

    // Geocode once per branch
    if (hasGeocodedRef.current !== branchId) {
      hasGeocodedRef.current = branchId;
      geocodeBranchAddressAsync(branchData.branch, queryClient, BRANCH_QUERY_KEY);
    }

    // Update estimated time in background
    calculateEstimatedTime().then(time => {
      queryClient.setQueryData(BRANCH_QUERY_KEY, (old: any) => {
        if (!old) return old;
        return { ...old, estimatedTime: time };
      });
    }).catch(() => { /* non-critical */ });
  }, [branchId, branchData?.branch, queryClient]);

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
