import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { EditableField } from '@/hooks/useEditableContent';

interface TextEditOverlayProps {
  field: EditableField | null;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export const TextEditOverlay = ({ field, onSave, onCancel }: TextEditOverlayProps) => {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (field) {
      setValue(field.value);
    }
  }, [field]);

  const handleSave = () => {
    onSave(value);
  };

  return (
    <Dialog open={!!field} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Text</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={6}
              className="resize-none"
              autoFocus
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Editing: <span className="font-mono">{field?.field}</span>
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
