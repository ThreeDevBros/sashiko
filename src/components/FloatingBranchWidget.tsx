import { useState, useEffect, useRef } from "react";
import { MapPin, Clock, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/hooks/useBranch";
import { toast } from "sonner";
import { dispatchBranchChanged, saveBranchId } from '@/lib/branch';
import type { Branch } from '@/types';

export const FloatingBranchWidget = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const widgetRef = useRef<HTMLDivElement>(null);
  const { branch, estimatedTime, loading } = useBranch();

  useEffect(() => {
    const fetchBranches = async () => {
      const { data } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true);
      if (data) setBranches(data);
    };
    fetchBranches();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  const handleBranchSelect = (branchId: string) => {
    saveBranchId(branchId);
    setIsExpanded(false);
    
    toast.success('Branch changed', {
      description: 'Menu updated for selected branch',
      duration: 2000,
    });
    
    dispatchBranchChanged();
  };

  // Widget hidden as per user request
  return null;
};
