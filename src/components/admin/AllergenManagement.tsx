import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';

export function AllergenManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [openDialog, setOpenDialog] = useState(false);
  const [editingAllergen, setEditingAllergen] = useState<any>(null);

  const { data: allergens } = useQuery({
    queryKey: ['allergens'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('allergens')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const createAllergenMutation = useMutation({
    mutationFn: async (formData: any) => {
      const { error } = await supabase
        .from('allergens')
        .insert([formData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allergens'] });
      toast({ title: 'Allergen created successfully' });
      setOpenDialog(false);
    },
  });

  const updateAllergenMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: any }) => {
      const { error } = await supabase
        .from('allergens')
        .update(formData)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allergens'] });
      toast({ title: 'Allergen updated successfully' });
      setOpenDialog(false);
      setEditingAllergen(null);
    },
  });

  const deleteAllergenMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('allergens')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allergens'] });
      toast({ title: 'Allergen deleted successfully' });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      description: formData.get('description'),
    };

    if (editingAllergen) {
      updateAllergenMutation.mutate({ id: editingAllergen.id, formData: data });
    } else {
      createAllergenMutation.mutate(data);
    }
  };

  const AllergenForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Allergen Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={editingAllergen?.name}
          placeholder="e.g., Peanuts, Gluten, Dairy"
          required
        />
      </div>
      
      <div>
        <Label htmlFor="description">Description (optional)</Label>
        <Input
          id="description"
          name="description"
          defaultValue={editingAllergen?.description}
          placeholder="Additional information"
        />
      </div>

      <Button type="submit" className="w-full" disabled={createAllergenMutation.isPending || updateAllergenMutation.isPending}>
        {(createAllergenMutation.isPending || updateAllergenMutation.isPending) ? 'Saving...' : `${editingAllergen ? 'Update' : 'Create'} Allergen`}
      </Button>
    </form>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Allergens</CardTitle>
          {isMobile ? (
            <Drawer open={openDialog} onOpenChange={(open) => {
              setOpenDialog(open);
              if (!open) setEditingAllergen(null);
            }}>
              <DrawerTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Allergen
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>
                    {editingAllergen ? 'Edit Allergen' : 'Add New Allergen'}
                  </DrawerTitle>
                </DrawerHeader>
                <div className="p-4">
                  <AllergenForm />
                </div>
              </DrawerContent>
            </Drawer>
          ) : (
            <Dialog open={openDialog} onOpenChange={(open) => {
              setOpenDialog(open);
              if (!open) setEditingAllergen(null);
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Allergen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingAllergen ? 'Edit Allergen' : 'Add New Allergen'}
                  </DialogTitle>
                </DialogHeader>
                <AllergenForm />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {allergens?.map((allergen) => (
            <div
              key={allergen.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-card"
            >
              <div>
                <p className="font-medium">{allergen.name}</p>
                {allergen.description && (
                  <p className="text-sm text-muted-foreground">{allergen.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingAllergen(allergen);
                    setOpenDialog(true);
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={deleteAllergenMutation.isPending}
                  onClick={() => {
                    if (confirm('Delete this allergen?')) {
                      deleteAllergenMutation.mutate(allergen.id);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {(!allergens || allergens.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No allergens added yet
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
