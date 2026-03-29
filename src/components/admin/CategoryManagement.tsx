import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { ImageUpload } from '@/components/admin/ImageUpload';
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

interface Category {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
}

function SortableCategory({ 
  category, 
  onEdit, 
  onDelete 
}: { 
  category: Category; 
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-4 border rounded-lg bg-card"
    >
      <button
        className="cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-5 h-5 text-muted-foreground" />
      </button>
      
      {category.image_url && (
        <img 
          src={category.image_url} 
          alt={category.name}
          className="w-12 h-12 object-cover rounded"
        />
      )}
      
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold truncate">{category.name}</h3>
        {category.description && (
          <p className="text-sm text-muted-foreground truncate">{category.description}</p>
        )}
      </div>
      
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onEdit(category)}
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={false}
          onClick={() => onDelete(category.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function CategoryManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');

  const { data: categories = [] } = useQuery({
    queryKey: ['menu-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_categories')
        .select('*')
        .order('display_order');
      if (error) throw error;
      return data as Category[];
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const createCategoryMutation = useMutation({
    mutationFn: async (formData: any) => {
      const maxOrder = Math.max(...categories.map(c => c.display_order), -1);
      const { error } = await supabase
        .from('menu_categories')
        .insert([{ ...formData, display_order: maxOrder + 1 }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
      toast({ title: 'Category created successfully' });
      setOpenDialog(false);
      setUploadedImageUrl('');
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('menu_categories')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
      toast({ title: 'Category updated successfully' });
      setEditingCategory(null);
      setOpenDialog(false);
      setUploadedImageUrl('');
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('menu_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
      toast({ title: 'Category deleted successfully' });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async (orderedCategories: Category[]) => {
      const updates = orderedCategories.map((cat, index) => ({
        id: cat.id,
        display_order: index,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('menu_categories')
          .update({ display_order: update.display_order })
          .eq('id', update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
      toast({ title: 'Category order updated' });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex((cat) => cat.id === active.id);
      const newIndex = categories.findIndex((cat) => cat.id === over.id);

      const newOrder = arrayMove(categories, oldIndex, newIndex);
      updateOrderMutation.mutate(newOrder);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      name: formData.get('name') as string,
      description: formData.get('description') as string || null,
      image_url: uploadedImageUrl || editingCategory?.image_url || null,
      is_active: formData.get('is_active') === 'on',
    };

    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data });
    } else {
      createCategoryMutation.mutate(data);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setUploadedImageUrl('');
    setOpenDialog(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this category?')) {
      deleteCategoryMutation.mutate(id);
    }
  };

  const CategoryForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input 
          id="name" 
          name="name" 
          defaultValue={editingCategory?.name} 
          required 
        />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea 
          id="description" 
          name="description" 
          defaultValue={editingCategory?.description || ''} 
        />
      </div>
      <div>
        <Label>Image</Label>
        <ImageUpload
          currentImageUrl={uploadedImageUrl || editingCategory?.image_url || ''}
          onUploadComplete={setUploadedImageUrl}
          folder="categories"
        />
      </div>
      <div className="flex items-center gap-2">
        <input 
          type="checkbox" 
          id="is_active" 
          name="is_active" 
          defaultChecked={editingCategory?.is_active ?? true}
        />
        <Label htmlFor="is_active" className="cursor-pointer">Active</Label>
      </div>
      <Button type="submit" className="w-full" disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}>
        {(createCategoryMutation.isPending || updateCategoryMutation.isPending) ? 'Saving...' : `${editingCategory ? 'Update' : 'Create'} Category`}
      </Button>
    </form>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Menu Categories</CardTitle>
        {isMobile ? (
          <Drawer open={openDialog} onOpenChange={(open) => {
            setOpenDialog(open);
            if (!open) setEditingCategory(null);
          }}>
            <DrawerTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Category
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>{editingCategory ? 'Edit' : 'Add'} Category</DrawerTitle>
              </DrawerHeader>
              <div className="px-4 pb-4">
                <CategoryForm />
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={openDialog} onOpenChange={(open) => {
            setOpenDialog(open);
            if (!open) setEditingCategory(null);
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCategory ? 'Edit' : 'Add'} Category</DialogTitle>
              </DialogHeader>
              <CategoryForm />
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No categories yet. Create your first category to get started.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={categories.map(c => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {categories.map((category) => (
                  <SortableCategory
                    key={category.id}
                    category={category}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
}
