import { useEffect, useState } from "react";
import { MapPin, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/hooks/useBranch";
import { dispatchBranchChanged, isBranchOpen } from "@/lib/branch";

interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  opens_at: string;
  closes_at: string;
  latitude: number | null;
  longitude: number | null;
  delivery_radius_km: number | null;
}

interface BranchSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BranchSelectorDialog = ({ open, onOpenChange }: BranchSelectorDialogProps) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const { branch: selectedBranch } = useBranch();

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const { data } = await supabase
          .from('branches')
          .select('*')
          .eq('is_active', true)
          .order('name');
        if (data) setBranches(data);
      } finally {
        setLoading(false);
      }
    };
    if (open) {
      fetchBranches();
    }
  }, [open]);

  const handleBranchSelect = (branchId: string) => {
    localStorage.setItem('selectedBranchId', branchId);
    dispatchBranchChanged();
    setTimeout(() => {
      onOpenChange(false);
    }, 200);
  };

  const formatTime = (time: string | null) => {
    if (!time) return 'N/A';
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-x-hidden overflow-y-visible" style={{ overscrollBehaviorX: 'none', touchAction: 'pan-y' }}>
        <DialogHeader>
          <DialogTitle>Select Branch</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 overflow-x-hidden w-full max-w-full overflow-y-auto max-h-[calc(100vh-220px)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-4">
                  <div className="space-y-2">
                    <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-full bg-muted rounded animate-pulse" />
                    <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
                  </div>
                </Card>
              ))}
            </div>
          ) : branches.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-sm text-muted-foreground">No branches available</p>
            </Card>
          ) : (
            branches.map((branch) => {
              const isOpen = isBranchOpen(branch.opens_at, branch.closes_at);
              return (
              <Card
                key={branch.id}
                onClick={() => handleBranchSelect(branch.id)}
                className={`p-4 cursor-pointer transition-all duration-200 hover:scale-[1.02] w-full max-w-full ${
                  selectedBranch?.id === branch.id
                    ? 'border-primary border-2 bg-primary/5 shadow-lg'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-base text-foreground">{branch.name}</h3>
                    <div className="flex items-center gap-1.5">
                      {!isOpen && (
                        <Badge variant="destructive" className="text-xs">Closed</Badge>
                      )}
                      {isOpen && (
                        <Badge variant="outline" className="text-xs border-green-500 text-green-600 dark:text-green-400">Open</Badge>
                      )}
                      {selectedBranch?.id === branch.id && (
                        <Badge variant="default" className="text-xs">Selected</Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                      <span>{branch.address}, {branch.city}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 flex-shrink-0 text-primary" />
                      <span>
                        {formatTime(branch.opens_at)} - {formatTime(branch.closes_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
