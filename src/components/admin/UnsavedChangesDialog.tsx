import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface UnsavedChangesDialogProps {
  open: boolean;
  onConfirmLeave: () => void;
  onCancelLeave: () => void;
}

export const UnsavedChangesDialog = ({ open, onConfirmLeave, onCancelLeave }: UnsavedChangesDialogProps) => (
  <Dialog open={open} onOpenChange={(o) => { if (!o) onCancelLeave(); }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Leave without saving?</DialogTitle>
        <DialogDescription>
          You have unsaved changes. If you leave now, your changes will be lost.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="flex gap-2 sm:gap-0">
        <Button variant="ghost" onClick={onConfirmLeave}>
          Discard Changes
        </Button>
        <Button onClick={onCancelLeave} className="bg-primary text-primary-foreground hover:bg-primary/90">
          Keep Editing
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
