import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface StaffBranchOption {
  id: string;
  name: string;
}

interface StaffBranchContextType {
  branches: StaffBranchOption[];
  selectedBranchId: string | null;
  selectedBranchName: string | null;
  setSelectedBranchId: (id: string) => void;
  isLoading: boolean;
}

const StaffBranchContext = createContext<StaffBranchContextType>({
  branches: [],
  selectedBranchId: null,
  selectedBranchName: null,
  setSelectedBranchId: () => {},
  isLoading: true,
});

export const useStaffBranch = () => useContext(StaffBranchContext);

export const StaffBranchProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthReady } = useAuth();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['staff-all-branches', user?.id],
    enabled: isAuthReady && !!user,
    queryFn: async () => {
      if (!user) return [];
      
      // Try staff_branches first
      const { data: staffData, error: staffError } = await supabase
        .from('staff_branches')
        .select('branch_id, branches(name)')
        .eq('user_id', user.id);
      
      if (!staffError && staffData && staffData.length > 0) {
        return staffData.map((row: any) => ({
          id: row.branch_id,
          name: row.branches?.name || 'Unknown Branch',
        }));
      }
      
      // Fallback: show all active branches for any staff user
      const { data: allBranches, error: branchError } = await supabase
        .from('branches')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      console.log('Staff branches fallback:', { allBranches, branchError, userId: user.id });
      
      return (allBranches || []).map((b: any) => ({ id: b.id, name: b.name }));
    },
  });

  // Auto-select first branch when data loads
  useEffect(() => {
    if (branches.length > 0 && !selectedBranchId) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, selectedBranchId]);

  const selectedBranchName = branches.find(b => b.id === selectedBranchId)?.name || null;

  return (
    <StaffBranchContext.Provider value={{
      branches,
      selectedBranchId,
      selectedBranchName,
      setSelectedBranchId,
      isLoading,
    }}>
      {children}
    </StaffBranchContext.Provider>
  );
};
