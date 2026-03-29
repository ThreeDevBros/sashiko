import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Plus, Trash2, GripVertical, X, Pencil } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useIsMobile } from '@/hooks/use-mobile';
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

interface ModifierInput {
  id: string;
  name: string;
  price_adjustment: number;
}

function SortableModifierRow({ 
  modifier, 
  onNameChange,
  onPriceChange,
  onRemove 
}: { 
  modifier: ModifierInput;
  onNameChange: (id: string, value: string) => void;
  onPriceChange: (id: string, value: number) => void;
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
        type="button"
        className="cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </button>
      
      <Input
        placeholder="Modifier name"
        defaultValue={modifier.name}
        onChange={(e) => onNameChange(modifier.id, e.target.value)}
        className="flex-1"
        required
      />
      
      <Input
        type="number"
        step="0.01"
        placeholder="Extra charge"
        defaultValue={modifier.price_adjustment || ''}
        onChange={(e) => onPriceChange(modifier.id, e.target.value === '' ? 0 : parseFloat(e.target.value))}
        className="w-28"
      />
      
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

export function ModifierManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [openDialog, setOpenDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [modifierIds, setModifierIds] = useState<string[]>([]);
  const modifiersRef = useRef<Map<string, ModifierInput>>(new Map());
  const [showMinimum, setShowMinimum] = useState(false);
  const [showMaximum, setShowMaximum] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [minSelections, setMinSelections] = useState('');
  const [maxSelections, setMaxSelections] = useState('');
  const [isRequired, setIsRequired] = useState(false);

  const { data: modifierGroups } = useQuery({
    queryKey: ['modifier-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modifier_groups')
        .select(`
          *,
          modifiers(id, name, price_adjustment)
        `)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const resetForm = useCallback(() => {
    setModifierIds([]);
    modifiersRef.current = new Map();
    setEditingGroup(null);
    setShowMinimum(false);
    setShowMaximum(false);
    setGroupName('');
    setMinSelections('');
    setMaxSelections('');
    setIsRequired(false);
  }, []);

  const createGroupMutation = useMutation({
    mutationFn: async ({ groupData, modifiers }: { groupData: any; modifiers: ModifierInput[] }) => {
      const { data: newGroup, error: groupError } = await supabase
        .from('modifier_groups')
        .insert([groupData])
        .select()
        .single();
      
      if (groupError) throw groupError;

      if (modifiers.length > 0) {
        const modifierInserts = modifiers.map(mod => ({
          group_id: newGroup.id,
          name: mod.name,
          price_adjustment: mod.price_adjustment,
        }));

        const { error: modError } = await supabase
          .from('modifiers')
          .insert(modifierInserts);
        
        if (modError) throw modError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modifier-groups'] });
      toast({ title: 'Modifier group created with modifiers' });
      setOpenDialog(false);
      resetForm();
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, groupData, modifiers }: { id: string; groupData: any; modifiers: ModifierInput[] }) => {
      const { error: updateError } = await supabase
        .from('modifier_groups')
        .update(groupData)
        .eq('id', id);
      
      if (updateError) throw updateError;

      const { error: deleteError } = await supabase
        .from('modifiers')
        .delete()
        .eq('group_id', id);
      
      if (deleteError) throw deleteError;

      if (modifiers.length > 0) {
        const modifierInserts = modifiers.map(mod => ({
          group_id: id,
          name: mod.name,
          price_adjustment: mod.price_adjustment,
        }));

        const { error: modError } = await supabase
          .from('modifiers')
          .insert(modifierInserts);
        
        if (modError) throw modError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modifier-groups'] });
      toast({ title: 'Modifier group updated' });
      setOpenDialog(false);
      resetForm();
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('modifier_groups')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modifier-groups'] });
      toast({ title: 'Modifier group deleted' });
    },
  });

  const handleSubmitGroup = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const groupData: any = {
      name: groupName,
      is_required: isRequired,
    };

    if (showMinimum) {
      if (!minSelections) {
        toast({ title: 'Please enter a minimum value', variant: 'destructive' });
        return;
      }
      groupData.min_selections = parseInt(minSelections);
    }

    if (showMaximum) {
      if (!maxSelections) {
        toast({ title: 'Please enter a maximum value', variant: 'destructive' });
        return;
      }
      groupData.max_selections = parseInt(maxSelections);
    } else {
      groupData.max_selections = 999;
    }

    // Collect current modifier values from ref
    const currentModifiers = modifierIds
      .map(id => modifiersRef.current.get(id))
      .filter(Boolean) as ModifierInput[];

    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup.id, groupData, modifiers: currentModifiers });
    } else {
      createGroupMutation.mutate({ groupData, modifiers: currentModifiers });
    }
  };

  const handleAddModifier = () => {
    const newId = `temp-${Date.now()}`;
    const newMod: ModifierInput = { id: newId, name: '', price_adjustment: 0 };
    modifiersRef.current.set(newId, newMod);
    setModifierIds(prev => [...prev, newId]);
  };

  const handleModifierNameChange = useCallback((id: string, value: string) => {
    const existing = modifiersRef.current.get(id);
    if (existing) {
      modifiersRef.current.set(id, { ...existing, name: value });
    }
  }, []);

  const handleModifierPriceChange = useCallback((id: string, value: number) => {
    const existing = modifiersRef.current.get(id);
    if (existing) {
      modifiersRef.current.set(id, { ...existing, price_adjustment: value });
    }
  }, []);

  const handleRemoveModifier = useCallback((id: string) => {
    modifiersRef.current.delete(id);
    setModifierIds(prev => prev.filter(mid => mid !== id));
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setModifierIds(prev => {
        const oldIndex = prev.findIndex(id => id === active.id);
        const newIndex = prev.findIndex(id => id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleOpenEdit = (group: any) => {
    setEditingGroup(group);
    setGroupName(group.name || '');
    setIsRequired(group.is_required || false);
    const minSel = (group as any).min_selections;
    const maxSel = (group as any).max_selections;
    setShowMinimum(!!minSel && minSel > 0);
    setShowMaximum(!!maxSel && maxSel < 999);
    setMinSelections(minSel ? String(minSel) : '');
    setMaxSelections(maxSel && maxSel < 999 ? String(maxSel) : '');

    const newMap = new Map<string, ModifierInput>();
    const ids: string[] = [];
    (group.modifiers || []).forEach((mod: any) => {
      newMap.set(mod.id, { id: mod.id, name: mod.name, price_adjustment: mod.price_adjustment });
      ids.push(mod.id);
    });
    modifiersRef.current = newMap;
    setModifierIds(ids);
    setOpenDialog(true);
  };

  const modifierItems = modifierIds.map(id => modifiersRef.current.get(id)!).filter(Boolean);

  const formContent = (
    <form onSubmit={handleSubmitGroup} className="space-y-4">
      <div>
        <Label htmlFor="group-name">Group Name</Label>
        <Input 
          id="group-name" 
          placeholder="e.g., Toppings" 
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          required 
        />
      </div>
      
      <div className="space-y-3">
        <Label>Selection Limits</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={showMinimum ? "default" : "outline"}
            size="sm"
            onClick={() => setShowMinimum(!showMinimum)}
          >
            Minimum
          </Button>
          <Button
            type="button"
            variant={showMaximum ? "default" : "outline"}
            size="sm"
            onClick={() => setShowMaximum(!showMaximum)}
          >
            Maximum
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {showMinimum && (
            <div>
              <Label htmlFor="min-selections">Minimum Selections</Label>
              <Input 
                id="min-selections" 
                type="number"
                value={minSelections}
                onChange={(e) => setMinSelections(e.target.value)}
                min={0}
              />
            </div>
          )}
          
          {showMaximum && (
            <div>
              <Label htmlFor="max-selections">Maximum Selections</Label>
              <Input 
                id="max-selections" 
                type="number"
                value={maxSelections}
                onChange={(e) => setMaxSelections(e.target.value)}
                min={1}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox 
          id="is-required" 
          checked={isRequired}
          onCheckedChange={(checked) => setIsRequired(checked === true)}
        />
        <Label htmlFor="is-required" className="cursor-pointer">Required</Label>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Modifiers</Label>
          <Button type="button" size="sm" onClick={handleAddModifier}>
            <Plus className="w-3 h-3 mr-1" />
            Add
          </Button>
        </div>

        {modifierItems.length > 0 && (
          <>
            <div className="grid grid-cols-[1fr_120px] gap-2 px-2 text-xs font-medium text-muted-foreground">
              <span>Name</span>
              <span>Extra Charge (€)</span>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={modifierIds}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {modifierItems.map((modifier) => (
                    <SortableModifierRow
                      key={modifier.id}
                      modifier={modifier}
                      onNameChange={handleModifierNameChange}
                      onPriceChange={handleModifierPriceChange}
                      onRemove={handleRemoveModifier}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        )}

        {modifierItems.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No modifiers added yet
          </p>
        )}
      </div>

      <Button type="submit" className="w-full">
        {editingGroup ? 'Update' : 'Create'} Group with Modifiers
      </Button>
    </form>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Modifier Groups</CardTitle>
        {isMobile ? (
          <Drawer open={openDialog} onOpenChange={(open) => {
            setOpenDialog(open);
            if (!open) resetForm();
          }}>
            <DrawerTrigger asChild>
              <Button size="sm" onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" />
                Add Group
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[90vh]">
              <DrawerHeader>
                <DrawerTitle>{editingGroup ? 'Edit' : 'Create'} Modifier Group</DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto px-4 pb-4">
                {formContent}
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={openDialog} onOpenChange={(open) => {
            setOpenDialog(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" />
                Add Group
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingGroup ? 'Edit' : 'Create'} Modifier Group</DialogTitle>
              </DialogHeader>
              {formContent}
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {!modifierGroups || modifierGroups.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No modifier groups yet. Create your first group to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {modifierGroups.map((group) => (
              <div key={group.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold">{group.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Max: {group.max_selections} {group.is_required && '• Required'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenEdit(group)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteGroupMutation.mutate(group.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {group.modifiers && group.modifiers.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {group.modifiers.map((mod: any) => (
                      <div key={mod.id} className="flex justify-between text-sm p-2 bg-muted rounded">
                        <span>{mod.name}</span>
                        <span className="text-muted-foreground">+€{mod.price_adjustment}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
