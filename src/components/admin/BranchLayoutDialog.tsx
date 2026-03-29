import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BranchLayoutDesigner from '@/pages/admin/BranchLayoutDesigner';

interface BranchLayoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  branchName: string;
}

export const BranchLayoutDialog = ({ open, onOpenChange, branchId, branchName }: BranchLayoutDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[90vw] max-h-[95vh] sm:max-h-[90vh] p-2 sm:p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base sm:text-lg">Layout Designer - {branchName}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[calc(95vh-60px)] sm:max-h-[calc(90vh-80px)]">
          <BranchLayoutDesigner initialBranchId={branchId} onClose={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
