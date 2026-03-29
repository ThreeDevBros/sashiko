import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

interface QuickEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  shape: 'rectangle' | 'circle' | 'square';
  type: string;
  seats?: number;
  onSave: (label: string, shape: 'rectangle' | 'circle' | 'square', seats?: number) => void;
}

export const QuickEditDialog = ({ open, onOpenChange, label, shape, type, seats, onSave }: QuickEditDialogProps) => {
  const isMobile = useIsMobile();
  const [editLabel, setEditLabel] = React.useState(label);
  const [editShape, setEditShape] = React.useState(shape);
  const [editSeats, setEditSeats] = React.useState(seats || 4);

  React.useEffect(() => {
    setEditLabel(label);
    setEditShape(shape);
    setEditSeats(seats || 4);
  }, [label, shape, seats]);

  const handleSave = () => {
    onSave(editLabel, editShape, type === 'table' ? editSeats : undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {type}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-label">Label</Label>
            <Input
              id="edit-label"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              placeholder={`e.g., ${type} 1`}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-shape">Shape</Label>
            {isMobile ? (
              <div className="relative mt-1">
                <select
                  value={editShape}
                  onChange={(e) => setEditShape(e.target.value as 'rectangle' | 'circle' | 'square')}
                  className="w-full min-h-[48px] appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 pr-10"
                >
                  <option value="rectangle">Rectangle</option>
                  <option value="square">Square</option>
                  <option value="circle">Circle</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
              </div>
            ) : (
              <Select value={editShape} onValueChange={(value) => setEditShape(value as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[10001]">
                  <SelectItem value="rectangle">Rectangle</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="circle">Circle</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {type === 'table' && (
            <div className="space-y-2">
              <Label htmlFor="edit-seats">Number of Chairs</Label>
              {isMobile ? (
                <div className="relative mt-1">
                  <select
                    value={editSeats}
                    onChange={(e) => setEditSeats(parseInt(e.target.value))}
                    className="w-full min-h-[48px] appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 pr-10"
                  >
                    {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'chair' : 'chairs'}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
                </div>
              ) : (
                <Input
                  id="edit-seats"
                  type="number"
                  min="1"
                  max="20"
                  value={editSeats}
                  onChange={(e) => setEditSeats(parseInt(e.target.value) || 4)}
                />
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
