import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function CouponManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);

  const { data: coupons } = useQuery({
    queryKey: ['coupons-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (formData: any) => {
      const { error } = await supabase
        .from('coupons')
        .insert([formData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons-admin'] });
      toast({ title: 'Coupon created successfully' });
      setOpenDialog(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: any) => {
      const { error } = await supabase
        .from('coupons')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons-admin'] });
      toast({ title: 'Coupon updated successfully' });
      setEditingCoupon(null);
      setOpenDialog(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons-admin'] });
      toast({ title: 'Coupon deleted successfully' });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      code: formData.get('code'),
      description: formData.get('description'),
      discount_type: formData.get('discount_type'),
      discount_value: parseFloat(formData.get('discount_value') as string),
      min_order_amount: parseFloat(formData.get('min_order_amount') as string) || 0,
      max_discount: formData.get('max_discount') ? parseFloat(formData.get('max_discount') as string) : null,
      usage_limit: formData.get('usage_limit') ? parseInt(formData.get('usage_limit') as string) : null,
      valid_until: formData.get('valid_until') || null,
      is_active: formData.get('is_active') === 'on',
    };

    if (editingCoupon) {
      updateMutation.mutate({ id: editingCoupon.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Coupon Management</h1>
            <p className="text-muted-foreground">Create and manage promotional coupons</p>
          </div>
          {isMobile ? (
            <Drawer open={openDialog} onOpenChange={(open) => {
              setOpenDialog(open);
              if (!open) setEditingCoupon(null);
            }}>
              <DrawerTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Coupon
                </Button>
              </DrawerTrigger>
              <DrawerContent className="max-h-[90vh]">
                <DrawerHeader>
                  <DrawerTitle>{editingCoupon ? 'Edit' : 'Add'} Coupon</DrawerTitle>
                </DrawerHeader>
                <div className="overflow-y-auto px-4 pb-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="code">Coupon Code</Label>
                        <Input id="code" name="code" defaultValue={editingCoupon?.code} required />
                      </div>
                      <div>
                        <Label htmlFor="discount_type">Discount Type</Label>
                        <Select name="discount_type" defaultValue={editingCoupon?.discount_type || 'percentage'} required>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage</SelectItem>
                            <SelectItem value="fixed">Fixed Amount</SelectItem>
                            <SelectItem value="bogo">BOGO</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea id="description" name="description" defaultValue={editingCoupon?.description} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="discount_value">Discount Value</Label>
                        <Input id="discount_value" name="discount_value" type="number" step="0.01" defaultValue={editingCoupon?.discount_value} required />
                      </div>
                      <div>
                        <Label htmlFor="min_order_amount">Min Order (€)</Label>
                        <Input id="min_order_amount" name="min_order_amount" type="number" step="0.01" defaultValue={editingCoupon?.min_order_amount || 0} />
                      </div>
                      <div>
                        <Label htmlFor="max_discount">Max Discount (€)</Label>
                        <Input id="max_discount" name="max_discount" type="number" step="0.01" defaultValue={editingCoupon?.max_discount} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="usage_limit">Usage Limit</Label>
                        <Input id="usage_limit" name="usage_limit" type="number" defaultValue={editingCoupon?.usage_limit} />
                      </div>
                      <div>
                        <Label htmlFor="valid_until">Valid Until</Label>
                        <Input id="valid_until" name="valid_until" type="datetime-local" defaultValue={editingCoupon?.valid_until} />
                      </div>
                    </div>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="is_active" defaultChecked={editingCoupon?.is_active ?? true} />
                      <span>Active</span>
                    </label>
                    <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                      {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : `${editingCoupon ? 'Update' : 'Create'} Coupon`}
                    </Button>
                  </form>
                </div>
              </DrawerContent>
            </Drawer>
          ) : (
            <Dialog open={openDialog} onOpenChange={(open) => {
              setOpenDialog(open);
              if (!open) setEditingCoupon(null);
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Coupon
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingCoupon ? 'Edit' : 'Add'} Coupon</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="code">Coupon Code</Label>
                      <Input id="code" name="code" defaultValue={editingCoupon?.code} required />
                    </div>
                    <div>
                      <Label htmlFor="discount_type">Discount Type</Label>
                      <Select name="discount_type" defaultValue={editingCoupon?.discount_type || 'percentage'} required>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                          <SelectItem value="bogo">BOGO</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" defaultValue={editingCoupon?.description} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="discount_value">Discount Value</Label>
                      <Input id="discount_value" name="discount_value" type="number" step="0.01" defaultValue={editingCoupon?.discount_value} required />
                    </div>
                    <div>
                      <Label htmlFor="min_order_amount">Min Order (€)</Label>
                      <Input id="min_order_amount" name="min_order_amount" type="number" step="0.01" defaultValue={editingCoupon?.min_order_amount || 0} />
                    </div>
                    <div>
                      <Label htmlFor="max_discount">Max Discount (€)</Label>
                      <Input id="max_discount" name="max_discount" type="number" step="0.01" defaultValue={editingCoupon?.max_discount} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="usage_limit">Usage Limit</Label>
                      <Input id="usage_limit" name="usage_limit" type="number" defaultValue={editingCoupon?.usage_limit} />
                    </div>
                    <div>
                      <Label htmlFor="valid_until">Valid Until</Label>
                      <Input id="valid_until" name="valid_until" type="datetime-local" defaultValue={editingCoupon?.valid_until} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="is_active" defaultChecked={editingCoupon?.is_active ?? true} />
                    <span>Active</span>
                  </label>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : `${editingCoupon ? 'Update' : 'Create'} Coupon`}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons?.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-primary" />
                        {coupon.code}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{coupon.discount_type}</TableCell>
                    <TableCell>
                      {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `€${coupon.discount_value}`}
                    </TableCell>
                    <TableCell>{coupon.times_used} / {coupon.usage_limit || '∞'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        coupon.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {coupon.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingCoupon(coupon);
                            setOpenDialog(true);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this coupon?')) {
                              deleteMutation.mutate(coupon.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
