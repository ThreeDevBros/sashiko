import { useEffect, useState, useRef } from 'react';
import { 
  fetchBranch, 
  getSavedBranchId, 
  saveBranchId, 
  calculateEstimatedTime 
} from '@/lib/branch';
import { supabase } from '@/integrations/supabase/client';
import { APP_CONFIG } from '@/constants';
import type { Branch } from '@/types';

/**
 * Geocode a branch address to get lat/lng when coordinates are missing.
 * Updates both local state and the database for future use.
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

    // Persist coordinates to the database so future loads don't need geocoding
    supabase
      .from('branches')
      .update({ latitude: data.latitude, longitude: data.longitude })
      .eq('id', branch.id)
      .then(({ error: updateErr }) => {
        if (updateErr) console.warn('Could not persist branch coordinates:', updateErr);
        else console.log(`Geocoded and saved coordinates for branch: ${branch.name}`);
      });

    return updatedBranch;
  } catch (err) {
    console.warn('Failed to geocode branch address:', err);
    return branch;
  }
};

export const useBranch = () => {
  const [branch, setBranch] = useState<Branch | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number>(APP_CONFIG.ESTIMATED_TIME_BASE);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const instanceId = useRef(Math.random().toString(36).slice(2, 8));

  useEffect(() => {
    const loadBranch = async () => {
      try {
        setLoading(true);
        const savedBranchId = getSavedBranchId();
        let data = await fetchBranch(savedBranchId || undefined);
        
        if (data) {
          // Geocode if coordinates are missing
          data = await geocodeBranchAddress(data);
          setBranch(data);
          if (!savedBranchId) {
            saveBranchId(data.id);
          }
          const time = await calculateEstimatedTime();
          setEstimatedTime(time);
        } else {
          setBranch(null);
          setEstimatedTime(APP_CONFIG.ESTIMATED_TIME_BASE);
        }
      } catch (error) {
        console.error('Error loading branch:', error);
        setBranch(null);
        setEstimatedTime(APP_CONFIG.ESTIMATED_TIME_BASE);
      } finally {
        setLoading(false);
      }
    };

    loadBranch();

    // Listen for branch changes
    const handleBranchChange = () => {
      setRefreshTrigger(prev => prev + 1);
    };

    window.addEventListener('branchChanged', handleBranchChange);

    // Update estimated time every minute
    const interval = setInterval(async () => {
      const time = await calculateEstimatedTime();
      setEstimatedTime(time);
    }, 60000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('branchChanged', handleBranchChange);
    };
  }, [refreshTrigger]);

  // Real-time subscription for branch updates (pause status, etc.)
  useEffect(() => {
    if (!branch?.id) return;

    const channel = supabase
      .channel(`branch-realtime-${branch.id}-${instanceId.current}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'branches',
          filter: `id=eq.${branch.id}`,
        },
        (payload) => {
          setBranch(prev => prev ? { ...prev, ...payload.new } as Branch : null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [branch?.id]);

  return { branch, estimatedTime, loading };
};
