import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { generateChairsForShape } from '@/lib/chairLayout';

interface Chair {
  id: string;
  x: number;
  y: number;
  rotation: number;
}

interface LayoutObject {
  id: string;
  type: 'table' | 'bar' | 'barstool' | 'window' | 'exit' | 'plant' | 'kitchen' | 'toilet' | 'wall';
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  rotation?: number;
  seats?: number;
  shape?: 'rectangle' | 'circle' | 'square';
  chairSides?: { top?: number; right?: number; bottom?: number; left?: number };
  chairs?: Chair[];
}

interface ObjectPropertiesPanelProps {
  object: LayoutObject | null;
  selectedChairId: string | null;
  onUpdate: (updates: Partial<LayoutObject>) => void;
  onChairUpdate?: (chairId: string, rotation: number) => void;
}

export const ObjectPropertiesPanel = ({ object, selectedChairId, onUpdate, onChairUpdate }: ObjectPropertiesPanelProps) => {
  const selectedChair = object?.chairs?.find(c => c.id === selectedChairId);
  const generateChairs = () => {
    if (!object || object.type !== 'table') return;
    const totalChairs = object.seats || 4;
    const chairs = generateChairsForShape(object.shape || 'rectangle', totalChairs, object.width, object.height);
    onUpdate({ chairs });
  };

  if (!object) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs sm:text-sm text-muted-foreground">Select an object to edit its properties</p>
        </CardContent>
      </Card>
    );
  }

  // If a chair is selected, show chair properties
  if (selectedChairId && selectedChair) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Chair Properties</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div>
            <Label className="text-xs sm:text-sm">Type</Label>
            <p className="text-xs sm:text-sm font-medium">Chair</p>
          </div>

          <div>
            <Label htmlFor="chair-rotation" className="text-xs sm:text-sm">Rotation (degrees)</Label>
            <Input
              id="chair-rotation"
              type="number"
              min="0"
              max="360"
              step="15"
              value={Math.round(selectedChair.rotation)}
              onChange={(e) => {
                const newRotation = parseInt(e.target.value);
                if (!isNaN(newRotation) && onChairUpdate) {
                  onChairUpdate(selectedChairId, newRotation % 360);
                }
              }}
              className="text-xs sm:text-sm"
            />
            <div className="flex gap-2 mt-2 flex-wrap">
              <Button 
                size="sm" 
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChairUpdate?.(selectedChairId, 0);
                }}
              >
                0°
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChairUpdate?.(selectedChairId, 90);
                }}
              >
                90°
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChairUpdate?.(selectedChairId, 180);
                }}
              >
                180°
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChairUpdate?.(selectedChairId, 270);
                }}
              >
                270°
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            <p>💡 Drag the chair to reposition it, or use the rotation controls above.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Properties</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        <div>
          <Label className="text-xs sm:text-sm">Type</Label>
          <p className="text-xs sm:text-sm font-medium capitalize">{object.type}</p>
        </div>

        <div>
          <Label htmlFor="shape" className="text-xs sm:text-sm">Shape</Label>
          <Select
            value={object.shape || 'rectangle'}
            onValueChange={(value) => onUpdate({ shape: value as 'rectangle' | 'circle' | 'square' })}
          >
            <SelectTrigger className="text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rectangle">Rectangle</SelectItem>
              <SelectItem value="square">Square</SelectItem>
              <SelectItem value="circle">Circle</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {object.type === 'table' && (
          <>
            <div>
              <Label htmlFor="seats" className="text-xs sm:text-sm">Total Seats</Label>
              <Input
                id="seats"
                type="number"
                min="1"
                max="20"
                value={object.seats || 4}
                onChange={(e) => {
                  const newSeats = parseInt(e.target.value);
                  if (isNaN(newSeats) || newSeats < 1) return;
                  const chairs = generateChairsForShape(object.shape || 'rectangle', newSeats, object.width, object.height);
                  onUpdate({ seats: newSeats, chairs });
                }}
                className="text-xs sm:text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Chairs are automatically placed around the table. Drag them to adjust.
              </p>
            </div>
          </>
        )}

        <div>
          <Label htmlFor="width" className="text-xs sm:text-sm">Width</Label>
          <Input
            id="width"
            type="number"
            min="20"
            max="300"
            value={object.width}
            onChange={(e) => onUpdate({ width: parseInt(e.target.value) })}
            className="text-xs sm:text-sm"
          />
        </div>

        <div>
          <Label htmlFor="height" className="text-xs sm:text-sm">Height</Label>
          <Input
            id="height"
            type="number"
            min="20"
            max="300"
            value={object.height}
            onChange={(e) => onUpdate({ height: parseInt(e.target.value) })}
            className="text-xs sm:text-sm"
          />
        </div>

        <div>
          <Label htmlFor="rotation" className="text-xs sm:text-sm">Rotation (degrees)</Label>
          <Input
            id="rotation"
            type="number"
            min="0"
            max="360"
            value={object.rotation || 0}
            onChange={(e) => onUpdate({ rotation: parseInt(e.target.value) })}
            className="text-xs sm:text-sm"
          />
        </div>

        <div>
          <Label htmlFor="label" className="text-xs sm:text-sm">Label (optional)</Label>
          <Input
            id="label"
            type="text"
            placeholder="e.g., Table 1"
            value={object.label || ''}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="text-xs sm:text-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
};
