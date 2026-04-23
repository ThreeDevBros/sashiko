import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateEstimatedTime } from '@/lib/branch';
import { subscribeToResume } from '@/lib/lifecycleManager';
import { prefetchMenuForBranch } from '@/lib/menuPrefetch';
import type { Branch } from '@/types';

const BRANCH_QUERY_KEY = ['branch-data'];

/**
 * Singleton component that owns ALL branch-related side effects.
 * Mount exactly once in App.tsx. This prevents duplicate realtime
 * channels, intervals, and resume listeners when useBranch() is
 * called from many components.
 */
export function BranchRealtimeManager() {
  const queryClient = useQueryClient();
  const instanceId = useRef(Math.random().toString(36).slice(2, 8));
  const [resumeCounter, setResumeCounter] = useState(0);
  const lastEstimateFailedRef = useRef(false);

  // Get current branch ID from cache
  const branchId = (queryClient.getQueryData(BRANCH_QUERY_KEY) as any)?.branch?.id as string | undefined;

  // Subscribe to cache changes to track branchId
  const [trackedBranchId, setTrackedBranchId] = useState<string | undefined>(branchId);

  useEffect(() => {
    const unsub = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query?.queryKey?.[0] === 'branch-data') {
        const data = queryClient.getQueryData(BRANCH_QUERY_KEY) as any;
        setTrackedBranchId(data?.branch?.id);
      }
    });
    return unsub;
  }, [queryClient]);

  // Resume listener — single instance
  useEffect(() => {
    return subscribeToResume(() => {
      setResumeCounter(prev => prev + 1);
    });
  }, []);

  // Prefetch menu data as soon as a branch is resolved or switched.
  // Fires before the user opens /order so the menu paints instantly.
  useEffect(() => {
    if (!trackedBranchId) return;
    prefetchMenuForBranch(queryClient, trackedBranchId);

    const onBranchChanged = () => {
      const data = queryClient.getQueryData(BRANCH_QUERY_KEY) as any;
      const id = data?.branch?.id;
      if (id) prefetchMenuForBranch(queryClient, id);
    };
    window.addEventListener('branchChanged', onBranchChanged);
    return () => window.removeEventListener('branchChanged', onBranchChanged);
  }, [trackedBranchId, queryClient]);

  // Realtime subscription — single channel, reconnects on resume
  useEffect(() => {
    if (!trackedBranchId) return;

    const channel = supabase
      .channel(`branch-rt-${trackedBranchId}-${instanceId.current}-${resumeCounter}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'branches',
          filter: `id=eq.${trackedBranchId}`,
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
  }, [trackedBranchId, queryClient, resumeCounter]);

  // Estimated time polling — single 60s interval with failure backoff
  useEffect(() => {
    const interval = setInterval(async () => {
      // Skip this tick if the last one failed (simple backoff)
      if (lastEstimateFailedRef.current) {
        lastEstimateFailedRef.current = false; // allow next tick
        return;
      }
      try {
        const time = await calculateEstimatedTime();
        queryClient.setQueryData(BRANCH_QUERY_KEY, (old: any) => {
          if (!old) return old;
          return { ...old, estimatedTime: time };
        });
      } catch {
        lastEstimateFailedRef.current = true;
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [queryClient]);

  return null;
}
