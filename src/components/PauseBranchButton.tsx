import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PauseCircle, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PauseBranchButtonProps {
  /** If provided, only toggle that branch. Otherwise toggle ALL active branches. */
  branchId?: string | null;
  /** Which feature to pause: 'orders' or 'reservations'. Defaults to 'orders'. */
  mode?: 'orders' | 'reservations';
}

export function PauseBranchButton({ branchId, mode = 'orders' }: PauseBranchButtonProps) {
  const queryClient = useQueryClient();
  const column = mode === 'reservations' ? 'is_reservations_paused' : 'is_paused';
  const label = mode === 'reservations' ? 'Reservations' : 'Orders';

  const { data: isPaused, isLoading } = useQuery({
    queryKey: ['branch-paused', branchId, mode],
    queryFn: async () => {
      if (branchId) {
        const { data, error } = await supabase
          .from('branches')
          .select(column)
          .eq('id', branchId)
          .single();
        if (error) throw error;
        return (data as any)?.[column] ?? false;
      }
      const { data, error } = await supabase
        .from('branches')
        .select(column)
        .eq('is_active', true);
      if (error) throw error;
      return data?.some((b: any) => b[column]) ?? false;
    },
  });

  // Real-time subscription for branch pause status
  useEffect(() => {
    const filter = branchId ? `id=eq.${branchId}` : undefined;
    const channel = supabase
      .channel(`pause-realtime-${branchId || 'all'}-${mode}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'branches',
          ...(filter ? { filter } : {}),
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['branch-paused'] });
          queryClient.invalidateQueries({ queryKey: ['branches'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [branchId, mode, queryClient]);

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const newValue = !isPaused;
      if (branchId) {
        const { error } = await supabase
          .from('branches')
          .update({ [column]: newValue } as any)
          .eq('id', branchId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('branches')
          .update({ [column]: newValue } as any)
          .eq('is_active', true);
        if (error) throw error;
      }
      return newValue;
    },
    onSuccess: (newValue) => {
      queryClient.invalidateQueries({ queryKey: ['branch-paused'] });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast.success(newValue ? `${label} paused — branch is now busy` : `${label} resumed!`);
    },
    onError: () => {
      toast.error(`Failed to update ${label.toLowerCase()} status`);
    },
  });

  if (isLoading) return null;

  return (
    <Button
      variant={isPaused ? 'default' : 'destructive'}
      size="default"
      onClick={() => toggleMutation.mutate()}
      disabled={toggleMutation.isPending}
      className={isPaused ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
    >
      {isPaused ? (
        <>
          <PlayCircle className="w-4 h-4 mr-1.5" />
          Resume {label}
        </>
      ) : (
        <>
          <PauseCircle className="w-4 h-4 mr-1.5" />
          Pause {label}
        </>
      )}
    </Button>
  );
}
