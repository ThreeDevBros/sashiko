import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface DeleteBranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchName: string;
  isDeleting: boolean;
  onConfirmDelete: () => void;
}

export function DeleteBranchDialog({
  open,
  onOpenChange,
  branchName,
  isDeleting,
  onConfirmDelete,
}: DeleteBranchDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);

  const handleOpenChange = (value: boolean) => {
    if (!value) setStep(1);
    onOpenChange(value);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        {step === 1 ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete branch?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete '{branchName}'? This will also remove all related data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => handleOpenChange(false)}>
                Cancel
              </AlertDialogCancel>
              <Button onClick={() => setStep(2)}>Continue</Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                This action is permanent
              </AlertDialogTitle>
              <AlertDialogDescription className="text-destructive font-medium">
                Deleting this branch will also delete ALL related records (orders, reservations, menu data, etc.). This cannot be recovered.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setStep(1)} disabled={isDeleting}>
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={onConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete branch'
                )}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
