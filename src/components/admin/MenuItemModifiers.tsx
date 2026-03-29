import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X, GripVertical, Plus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ModifierGroup {
  id: string;
  name: string;
  is_required: boolean;
  max_selections: number;
}

interface SelectedModifier {
  id: string;
  modifier_group_id: string;
  name: string;
}

function SortableModifier({ 
  modifier, 
  onRemove 
}: { 
  modifier: SelectedModifier;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: modifier.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 border rounded-lg bg-card"
    >
      <button
        className="cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </button>
      
      <span className="flex-1 text-sm">{modifier.name}</span>
      
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => onRemove(modifier.id)}
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}

export function MenuItemModifiers({ 
  initialModifiers = [],
  onChange 
}: { 
  initialModifiers?: string[];
  onChange: (modifierGroupIds: string[]) => void;
}) {
  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifier[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  const { data: modifierGroups = [] } = useQuery({
    queryKey: ['modifier-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modifier_groups')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as ModifierGroup[];
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize with existing modifiers
  useEffect(() => {
    if (initialModifiers.length > 0 && modifierGroups.length > 0) {
      const initialSelected = initialModifiers
        .map(groupId => {
          const group = modifierGroups.find(g => g.id === groupId);
          return group ? {
            id: group.id,
            modifier_group_id: group.id,
            name: group.name,
          } : null;
        })
        .filter(Boolean) as SelectedModifier[];
      setSelectedModifiers(initialSelected);
    }
  }, [initialModifiers, modifierGroups]);

  // Notify parent of changes
  useEffect(() => {
    onChange(selectedModifiers.map(m => m.modifier_group_id));
  }, [selectedModifiers, onChange]);

  const handleAddModifier = () => {
    if (!selectedGroupId) return;
    
    const group = modifierGroups.find(g => g.id === selectedGroupId);
    if (!group) return;

    // Check if already added
    if (selectedModifiers.some(m => m.modifier_group_id === selectedGroupId)) {
      return;
    }

    const newModifier: SelectedModifier = {
      id: group.id,
      modifier_group_id: group.id,
      name: group.name,
    };

    setSelectedModifiers([...selectedModifiers, newModifier]);
    setSelectedGroupId('');
  };

  const handleRemoveModifier = (id: string) => {
    setSelectedModifiers(selectedModifiers.filter(m => m.id !== id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = selectedModifiers.findIndex((m) => m.id === active.id);
      const newIndex = selectedModifiers.findIndex((m) => m.id === over.id);

      setSelectedModifiers(arrayMove(selectedModifiers, oldIndex, newIndex));
    }
  };

  const availableGroups = modifierGroups.filter(
    g => !selectedModifiers.some(m => m.modifier_group_id === g.id)
  );

  return (
    <div className="space-y-3">
      <Label>Modifier Groups</Label>
      
      <div className="flex gap-2">
        <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select modifier group" />
          </SelectTrigger>
          <SelectContent className="bg-background border z-50">
            {availableGroups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
                {group.is_required && ' (Required)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Button
          type="button"
          onClick={handleAddModifier}
          disabled={!selectedGroupId}
          size="sm"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {selectedModifiers.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={selectedModifiers.map(m => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {selectedModifiers.map((modifier) => (
                <SortableModifier
                  key={modifier.id}
                  modifier={modifier}
                  onRemove={handleRemoveModifier}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {selectedModifiers.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No modifier groups added yet
        </p>
      )}
    </div>
  );
}
