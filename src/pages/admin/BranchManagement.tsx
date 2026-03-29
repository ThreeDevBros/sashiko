import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { UnsavedChangesDialog } from '@/components/admin/UnsavedChangesDialog';
import { Plus, Pencil, Trash2, MapPin, Search, LayoutGrid, Star, RefreshCw } from 'lucide-react';
import { BranchLayoutDialog } from '@/components/admin/BranchLayoutDialog';
import { DeleteBranchDialog } from '@/components/admin/DeleteBranchDialog';
import { MapLocationPicker } from '@/components/admin/MapLocationPicker';
import { useIsMobile } from '@/hooks/use-mobile';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { MobileBranchCards } from '@/components/admin/MobileBranchCards';
import { BranchHoursEditor, getInitialHours } from '@/components/admin/BranchHoursEditor';
import type { BranchHours } from '@/types';

export default function BranchManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [openDialog, setOpenDialog] = useState(false);
  const isDirty = openDialog;
  const { showDialog, confirmLeave, cancelLeave } = useUnsavedChangesWarning(isDirty);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutDialogOpen, setLayoutDialogOpen] = useState(false);
  const [selectedBranchForLayout, setSelectedBranchForLayout] = useState<any>(null);
  const [deleteBranch, setDeleteBranch] = useState<any>(null);
  const [branchName, setBranchName] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [selectedCoordinates, setSelectedCoordinates] = useState<{
    lat: number;
    lng: number;
    address?: string;
    city?: string;
    placeId?: string;
  } | null>(null);
  const [deliveryRadius, setDeliveryRadius] = useState<'1' | '5' | '10' | 'custom'>('5');
  const [customRadius, setCustomRadius] = useState<string>('');
  const [branchHours, setBranchHours] = useState<BranchHours[]>(getInitialHours());
  const [fetchingRating, setFetchingRating] = useState(false);
  const [fetchedRating, setFetchedRating] = useState<{ rating: number | null; review_count: number | null } | null>(null);

  const isBranchNameValid = branchName.trim().length >= 2;
  const phoneDigits = phone.replace(/\D/g, '');
  const isPhoneValid = phoneDigits.length >= 6;

  const { data: branches } = useQuery({
    queryKey: ['branches-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('branches').select('*').order('name');
      if (error) throw error;
      return data;
    }
  });

  // Load hours for editing branch
  const { data: existingHours } = useQuery({
    queryKey: ['branch-hours', editingBranch?.id],
    queryFn: async () => {
      if (!editingBranch?.id) return [];
      const { data, error } = await supabase
        .from('branch_hours')
        .select('*')
        .eq('branch_id', editingBranch.id)
        .order('day_of_week');
      if (error) throw error;
      return data as BranchHours[];
    },
    enabled: !!editingBranch?.id,
  });

  useEffect(() => {
    if (existingHours) {
      setBranchHours(getInitialHours(existingHours));
    }
  }, [existingHours]);

  const fetchGoogleRating = async (placeId?: string) => {
    const pid = placeId;
    if (!pid) return;
    setFetchingRating(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-google-reviews', {
        body: { place_id: pid, branch_id: editingBranch?.id || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setFetchedRating({ rating: data.rating, review_count: data.review_count });
      toast({ title: `Rating: ${data.rating} ★ (${data.review_count} reviews)` });

      // Auto-populate operating hours from Google if available and hours are still defaults
      if (data.opening_hours && Array.isArray(data.opening_hours)) {
        const googleHours = data.opening_hours.map((gh: any) => ({
          day_of_week: gh.day_of_week,
          is_closed: gh.is_closed ?? false,
          is_24h: gh.is_24h ?? false,
          open_time: gh.open_time || '09:00',
          close_time: gh.close_time || '22:00',
          delivery_open_time: gh.open_time || '09:00',
          delivery_close_time: gh.close_time || '22:00',
          delivery_enabled: !gh.is_closed,
        }));
        setBranchHours(googleHours);
        toast({ title: 'Operating hours auto-filled from Google' });
      }
    } catch (err: any) {
      let message = err?.message || 'Failed to fetch rating';

      if (typeof err?.context?.json === 'function') {
        try {
          const payload = await err.context.json();
          message = payload?.error || payload?.message || message;
        } catch {
          // Ignore parse failures and keep fallback message
        }
      }

      toast({ title: 'Failed to fetch rating', description: message, variant: 'destructive' });
    } finally {
      setFetchingRating(false);
    }
  };

  // Auto-fetch Google reviews when a place is selected via autocomplete
  const handleLocationSelect = (lat: number, lng: number, address?: string, city?: string, placeId?: string) => {
    setSelectedCoordinates({ lat, lng, address, city, placeId });
    if (placeId) {
      fetchGoogleRating(placeId);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (formData: any) => {
      const { data, error } = await supabase.from('branches').insert([formData]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (newBranch) => {
      // Save hours
      await saveBranchHours(newBranch.id);
      queryClient.invalidateQueries({ queryKey: ['branches-admin'] });
      toast({ title: 'Branch created successfully' });
      setOpenDialog(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: any) => {
      const { error } = await supabase.from('branches').update(data).eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: async (branchId) => {
      await saveBranchHours(branchId);
      queryClient.invalidateQueries({ queryKey: ['branches-admin'] });
      toast({ title: 'Branch updated successfully' });
      setEditingBranch(null);
      setOpenDialog(false);
    }
  });

  const saveBranchHours = async (branchId: string) => {
    // Delete existing hours for this branch then re-insert
    await supabase.from('branch_hours').delete().eq('branch_id', branchId);
    const rows = branchHours.map(h => ({
      branch_id: branchId,
      day_of_week: h.day_of_week,
      is_closed: h.is_closed,
      is_24h: h.is_24h,
      open_time: h.is_closed ? null : (h.is_24h ? null : h.open_time),
      close_time: h.is_closed ? null : (h.is_24h ? null : h.close_time),
      delivery_open_time: h.is_closed || !h.delivery_enabled ? null : (h.is_24h ? null : h.delivery_open_time),
      delivery_close_time: h.is_closed || !h.delivery_enabled ? null : (h.is_24h ? null : h.delivery_close_time),
      delivery_enabled: h.is_closed ? false : h.delivery_enabled,
    }));
    const { error } = await supabase.from('branch_hours').insert(rows);
    if (error) console.error('Failed to save branch hours:', error);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('branches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches-admin'] });
      toast({ title: 'Branch deleted', description: 'Branch and all related records removed.' });
      setDeleteBranch(null);
    },
    onError: (error: any) => {
      toast({ title: 'Delete failed', description: error?.message || 'Failed to delete branch', variant: 'destructive' });
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const canSubmit = isBranchNameValid && isPhoneValid && !isSubmitting;

  const resetForm = () => {
    setEditingBranch(null);
    setSelectedCoordinates(null);
    setDeliveryRadius('5');
    setCustomRadius('');
    setBranchName('');
    setPhone('');
    setDescription('');
    setNameError('');
    setNameError('');
    setPhoneError('');
    setBranchHours(getInitialHours());
    setFetchedRating(null);
  };

  const openEdit = (branch: any) => {
    setEditingBranch(branch);
    setBranchName(branch.name || '');
    setPhone(branch.phone || '');
    setDescription(branch.description || '');
    setNameError('');
    setPhoneError('');
    setFetchedRating(
      branch.google_maps_rating ? { rating: branch.google_maps_rating, review_count: branch.google_maps_review_count } : null
    );
    setSelectedCoordinates(branch.latitude && branch.longitude ? { lat: branch.latitude, lng: branch.longitude } : null);
    const radius = branch.delivery_radius_km || 5;
    if (radius === 1 || radius === 5 || radius === 10) {
      setDeliveryRadius(radius.toString() as '1' | '5' | '10');
      setCustomRadius('');
    } else {
      setDeliveryRadius('custom');
      setCustomRadius(radius.toString());
    }
    setOpenDialog(true);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isBranchNameValid) { setNameError('Branch name must be at least 2 characters'); return; }
    if (!isPhoneValid) { setPhoneError('Phone must have at least 6 digits'); return; }

    const formData = new FormData(e.currentTarget);
    let finalRadius: number;
    if (deliveryRadius === 'custom') {
      finalRadius = parseFloat(customRadius) || 5;
    } else {
      finalRadius = parseFloat(deliveryRadius);
    }

    const data: any = {
      name: branchName.trim(),
      address: selectedCoordinates?.address || 'Address not available',
      city: selectedCoordinates?.city || 'City not available',
      phone: phone.trim(),
      description: description.trim() || null,
      latitude: selectedCoordinates?.lat || null,
      longitude: selectedCoordinates?.lng || null,
      delivery_radius_km: finalRadius,
      is_active: formData.get('is_active') === 'on',
      google_maps_place_id: selectedCoordinates?.placeId || editingBranch?.google_maps_place_id || null,
    };

    if (fetchedRating) {
      data.google_maps_rating = fetchedRating.rating;
      data.google_maps_review_count = fetchedRating.review_count;
    }

    if (editingBranch) {
      updateMutation.mutate({ id: editingBranch.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredBranches = branches?.filter(branch => {
    const searchLower = searchQuery.toLowerCase();
    return branch.name?.toLowerCase().includes(searchLower) || branch.address?.toLowerCase().includes(searchLower) || branch.city?.toLowerCase().includes(searchLower) || branch.phone?.toLowerCase().includes(searchLower);
  });

  const branchFormContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Branch Name <span className="text-destructive">*</span></Label>
        <Input id="name" name="name" value={branchName} onChange={e => { setBranchName(e.target.value); setNameError(''); }} onBlur={() => { if (branchName.trim().length > 0 && branchName.trim().length < 2) setNameError('Branch name must be at least 2 characters'); }} />
        {nameError && <p className="text-xs text-destructive mt-1">{nameError}</p>}
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Brief description of this branch (shown to customers)..."
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          className="resize-none"
        />
      </div>

      <div>
        <Label htmlFor="phone">Phone <span className="text-destructive">*</span></Label>
        <Input id="phone" name="phone" value={phone} onChange={e => { setPhone(e.target.value); setPhoneError(''); }} onBlur={() => { if (phone.trim() && phone.replace(/\D/g, '').length < 6) setPhoneError('Phone must have at least 6 digits'); }} />
        {phoneError && <p className="text-xs text-destructive mt-1">{phoneError}</p>}
      </div>

      {/* Enhanced hours editor */}
      <BranchHoursEditor hours={branchHours} onChange={setBranchHours} />

      {/* Google rating preview card */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Google Maps Reviews</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            disabled={fetchingRating}
            onClick={() => {
              const pid = selectedCoordinates?.placeId || editingBranch?.google_maps_place_id;
              if (pid) {
                fetchGoogleRating(pid);
              } else {
                toast({ title: 'Select a location on the map first to fetch reviews', variant: 'destructive' });
              }
            }}
          >
            <RefreshCw className={`w-3 h-3 ${fetchingRating ? 'animate-spin' : ''}`} />
            {fetchingRating ? 'Fetching...' : 'Refresh'}
          </Button>
        </div>
        {fetchedRating?.rating ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${
                    star <= Math.round(fetchedRating.rating!)
                      ? 'text-amber-500 fill-amber-500'
                      : 'text-muted-foreground/30'
                  }`}
                />
              ))}
            </div>
            <span className="text-sm font-semibold">{fetchedRating.rating}</span>
            <span className="text-xs text-muted-foreground">({fetchedRating.review_count} reviews)</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {fetchingRating ? 'Loading reviews...' : 'Select a location on the map to auto-fetch Google reviews.'}
          </p>
        )}
      </div>

      <div>
        <Label>Restaurant Location (address & city auto-filled from map)</Label>
        <MapLocationPicker useSatellite initialLat={editingBranch?.latitude} initialLng={editingBranch?.longitude} onLocationSelect={handleLocationSelect} deliveryRadiusKm={deliveryRadius === 'custom' ? parseFloat(customRadius) || 5 : parseFloat(deliveryRadius)} />
      </div>

      <div>
        <Label>Delivery Radius</Label>
        <div className="flex items-center gap-2 flex-wrap">
          {(['1', '5', '10'] as const).map(r => (
            <Button key={r} type="button" variant={deliveryRadius === r ? 'default' : 'outline'} size="sm" onClick={() => { setDeliveryRadius(r); setCustomRadius(''); }}>
              {r} km
            </Button>
          ))}
          <Button type="button" variant={deliveryRadius === 'custom' ? 'default' : 'outline'} size="sm" onClick={() => setDeliveryRadius('custom')}>
            Custom
          </Button>
          {deliveryRadius === 'custom' && <Input type="number" step="0.1" min="0.1" placeholder="Enter km" value={customRadius} onChange={e => setCustomRadius(e.target.value)} className="w-24" required />}
        </div>
      </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" name="is_active" defaultChecked={editingBranch?.is_active ?? true} />
        <span>Active</span>
      </label>

      <Button type="submit" className="w-full" disabled={!canSubmit}>
        {isSubmitting ? 'Saving...' : `${editingBranch ? 'Update' : 'Create'} Branch`}
      </Button>
    </form>
  );

  return <>
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Branch Management</h1>
            <p className="text-muted-foreground">Manage your restaurant locations</p>
          </div>
          {isMobile ? (
            <Drawer open={openDialog} onOpenChange={open => { setOpenDialog(open); if (!open) resetForm(); }}>
              <DrawerTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Branch
                </Button>
              </DrawerTrigger>
              <DrawerContent className="max-h-[90vh]">
                <DrawerHeader>
                  <DrawerTitle>{editingBranch ? 'Edit' : 'Add'} Branch</DrawerTitle>
                </DrawerHeader>
                <div className="overflow-y-auto px-4 pb-4">
                  {branchFormContent}
                </div>
              </DrawerContent>
            </Drawer>
          ) : (
            <Dialog open={openDialog} onOpenChange={open => { setOpenDialog(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Branch
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingBranch ? 'Edit' : 'Add'} Branch</DialogTitle>
                </DialogHeader>
                {branchFormContent}
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardContent className="pt-6 px-6 pb-0">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search branches by name, address, city, or phone..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
          </CardContent>

          {/* Mobile/Tablet: card layout */}
          <div className="block lg:hidden">
            <MobileBranchCards
              branches={filteredBranches || []}
              onEdit={openEdit}
              onDelete={(branch) => setDeleteBranch(branch)}
              onLayout={(branch) => { setSelectedBranchForLayout(branch); setLayoutDialogOpen(true); }}
            />
          </div>

          {/* Desktop: table layout */}
          <CardContent className="p-0 hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBranches?.map(branch => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        {branch.name}
                      </div>
                    </TableCell>
                    <TableCell>{branch.address}, {branch.city}</TableCell>
                    <TableCell>{branch.phone}</TableCell>
                    <TableCell>
                      {branch.google_maps_rating ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          <span>{branch.google_maps_rating}</span>
                          {branch.google_maps_review_count && (
                            <span className="text-muted-foreground">({branch.google_maps_review_count})</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${branch.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {branch.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => { setSelectedBranchForLayout(branch); setLayoutDialogOpen(true); }} title="Edit Layout">
                          <LayoutGrid className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(branch)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteBranch(branch)}>
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

        {selectedBranchForLayout && <BranchLayoutDialog open={layoutDialogOpen} onOpenChange={setLayoutDialogOpen} branchId={selectedBranchForLayout.id} branchName={selectedBranchForLayout.name} />}

        <DeleteBranchDialog
          open={!!deleteBranch}
          onOpenChange={(open) => { if (!open) setDeleteBranch(null); }}
          branchName={deleteBranch?.name || ''}
          isDeleting={deleteMutation.isPending}
          onConfirmDelete={() => deleteBranch && deleteMutation.mutate(deleteBranch.id)}
        />
      </div>
    </AdminLayout>
    <UnsavedChangesDialog open={showDialog} onConfirmLeave={confirmLeave} onCancelLeave={cancelLeave} />
  </>;
}
