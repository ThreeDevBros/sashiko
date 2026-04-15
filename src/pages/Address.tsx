import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Plus, Edit2, Trash2, Star, Home, Building2, Briefcase, Building, MoreHorizontal, Navigation, Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AddressMapPicker } from '@/components/address/AddressMapPicker';
import { AddressSearchPicker } from '@/components/address/AddressSearchPicker';
import { BackButton } from '@/components/BackButton';
import { getCurrentPosition, isGeolocationAvailable } from '@/lib/geolocation';
import LoadingScreen from '@/components/LoadingScreen';
import { getAddressIcon } from '@/lib/addressIcons';
import { useAuth } from '@/contexts/AuthContext';

type ViewMode = 'list' | 'add_search' | 'add_manual_map' | 'add_manual_form' | 'add_label' | 'edit';

const labelShortcuts = [
  { value: 'Home', icon: Home },
  { value: 'Office', icon: Building2 },
  { value: 'Work', icon: Briefcase },
  { value: 'School', icon: Building },
];

export default function Address() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user: authUser, isAuthReady } = useAuth();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingAddress, setEditingAddress] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<any>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    address_line1: '',
    address_line2: '',
    city: '',
    postal_code: '',
    latitude: null as number | null,
    longitude: null as number | null,
  });

  // Use auth context instead of one-shot getSession to avoid race on resume
  useEffect(() => {
    if (!isAuthReady) return;
    if (!authUser) {
      setLoading(false);
      navigate('/auth');
      return;
    }
    setUser(authUser);
    setLoading(false);
  }, [isAuthReady, authUser]);

  useEffect(() => {
    if (user?.id) {
      fetchAddresses();
    }
  }, [user?.id]);

  // Handle deep-link query params (action=add or action=edit&id=xxx)
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);
  useEffect(() => {
    if (deepLinkHandled || !user?.id) return;
    const action = searchParams.get('action');
    if (action === 'add') {
      setDeepLinkHandled(true);
      openAddDialog();
    } else if (action === 'edit') {
      const editId = searchParams.get('id');
      if (editId && addresses.length > 0) {
        const addr = addresses.find(a => a.id === editId);
        if (addr) {
          setDeepLinkHandled(true);
          openEditDialog(addr);
        }
      }
    }
  }, [user?.id, addresses, searchParams, deepLinkHandled]);

  // checkUser is now handled by the auth context effect above

  const fetchAddresses = async () => {
    try {
      const { data, error } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setAddresses(data || []);
    } catch (error: any) {
      console.error('Fetch addresses error:', error);
      toast({
        title: "Error",
        description: "Failed to load addresses",
        variant: "destructive",
      });
    }
  };

  const openAddDialog = () => {
    setEditingAddress(null);
    setAddressForm({
      label: 'Home',
      address_line1: '',
      address_line2: '',
      city: '',
      postal_code: '',
      latitude: null,
      longitude: null,
    });
    setViewMode('add_search');
  };

  const handleSearchAddressSelect = (address: any) => {
    setAddressForm(prev => ({
      ...prev,
      address_line1: address.address_line1 || '',
      city: address.city || '',
      postal_code: address.postal_code || '',
      latitude: address.latitude,
      longitude: address.longitude,
    }));
    // Go to form view to confirm/edit the auto-filled address
    setViewMode('add_manual_form');
  };

  const handleMapLocationSelect = (lat: number, lng: number, address?: string, city?: string, postalCode?: string) => {
    setAddressForm(prev => ({
      ...prev,
      address_line1: address || prev.address_line1,
      city: city || prev.city,
      postal_code: postalCode || prev.postal_code,
      latitude: lat,
      longitude: lng,
    }));
  };

  const handleCurrentLocationForAdd = async () => {
    if (!isGeolocationAvailable()) {
      toast({
        title: 'Location not supported',
        description: 'Your browser does not support geolocation.',
        variant: 'destructive',
      });
      return;
    }

    setGettingLocation(true);
    
    try {
      const position = await getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      const { latitude, longitude } = position.coords;
      
      // Use Google Maps Geocoder for reverse geocoding
      if (window.google?.maps) {
        const geocoder = new google.maps.Geocoder();
        const result = await geocoder.geocode({ location: { lat: latitude, lng: longitude } });
        
        if (result.results && result.results.length > 0) {
          const place = result.results[0];
          let streetNumber = '';
          let route = '';
          let city = '';
          let postalCode = '';

          place.address_components?.forEach(component => {
            if (component.types.includes('street_number')) {
              streetNumber = component.long_name;
            }
            if (component.types.includes('route')) {
              route = component.long_name;
            }
            if (component.types.includes('locality') || component.types.includes('administrative_area_level_1')) {
              city = component.long_name;
            }
            if (component.types.includes('postal_code')) {
              postalCode = component.long_name;
            }
          });

          const address_line1 = streetNumber ? `${streetNumber} ${route}` : route || place.formatted_address?.split(',')[0] || '';

          setAddressForm(prev => ({
            ...prev,
            address_line1,
            city,
            postal_code: postalCode,
            latitude,
            longitude,
          }));
          
          setViewMode('add_manual_form');
          toast({
            title: 'Location detected',
            description: 'Please confirm your address details.',
          });
        } else {
          throw new Error('No geocoding results');
        }
      } else {
        // Fallback to OpenStreetMap
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
        );
        const data = await response.json();
        
        setAddressForm(prev => ({
          ...prev,
          address_line1: data.address?.road || data.address?.suburb || data.display_name?.split(',')[0] || '',
          city: data.address?.city || data.address?.town || data.address?.village || '',
          postal_code: data.address?.postcode || '',
          latitude,
          longitude,
        }));
        
        setViewMode('add_manual_form');
        toast({
          title: 'Location detected',
          description: 'Please confirm your address details.',
        });
      }
    } catch (error) {
      console.error('Error getting address:', error);
      toast({
        title: 'Location error',
        description: 'Could not get your current location. Please allow location access.',
        variant: 'destructive',
      });
    } finally {
      setGettingLocation(false);
    }
  };
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleSaveAddress = async () => {
    if (!user?.id) return;
    const trimmedLabel = addressForm.label.trim();
    if (!trimmedLabel) {
      toast({ title: 'Missing label', description: 'Please enter an address name', variant: 'destructive' });
      return;
    }
    try {
      const isFirstAddress = addresses.length === 0;
      
      const { error } = await supabase
        .from('user_addresses')
        .insert({
          user_id: user.id,
          label: trimmedLabel,
          address_line1: addressForm.address_line1,
          address_line2: addressForm.address_line2 || null,
          city: addressForm.city,
          postal_code: addressForm.postal_code || null,
          latitude: addressForm.latitude,
          longitude: addressForm.longitude,
          is_default: isFirstAddress,
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Address saved successfully',
      });

      setViewMode('list');
      fetchAddresses();
    } catch (error: any) {
      console.error('Save address error:', error);
      toast({
        title: 'Error',
        description: 'Failed to save address',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (address: any) => {
    setEditingAddress(address);
    setAddressForm({
      label: address.label,
      address_line1: address.address_line1,
      address_line2: address.address_line2 || '',
      city: address.city,
      postal_code: address.postal_code || '',
      latitude: address.latitude,
      longitude: address.longitude,
    });
    setViewMode('edit');
  };

  const handleUpdateAddress = async () => {
    if (!editingAddress?.id) return;
    const trimmedLabel = addressForm.label.trim();
    if (!trimmedLabel) {
      toast({ title: 'Missing label', description: 'Please enter an address name', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase
        .from('user_addresses')
        .update({
          label: trimmedLabel,
          address_line1: addressForm.address_line1,
          address_line2: addressForm.address_line2 || null,
          city: addressForm.city,
          postal_code: addressForm.postal_code || null,
          latitude: addressForm.latitude,
          longitude: addressForm.longitude,
        })
        .eq('id', editingAddress.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Address updated successfully',
      });

      setViewMode('list');
      fetchAddresses();
    } catch (error: any) {
      console.error('Update address error:', error);
      toast({
        title: 'Error',
        description: 'Failed to update address',
        variant: 'destructive',
      });
    }
  };

  const confirmDeleteAddress = (address: any) => {
    setAddressToDelete(address);
    setDeleteDialogOpen(true);
  };

  const handleDeleteAddress = async () => {
    if (!addressToDelete?.id) return;

    try {
      const { error } = await supabase
        .from('user_addresses')
        .delete()
        .eq('id', addressToDelete.id);

      if (error) throw error;

      toast({
        title: 'Deleted',
        description: 'Address removed successfully',
      });

      setDeleteDialogOpen(false);
      setAddressToDelete(null);
      fetchAddresses();
    } catch (error: any) {
      console.error('Delete address error:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete address',
        variant: 'destructive',
      });
    }
  };

  const handleSetDefault = async (addressId: string) => {
    try {
      // First, unset all defaults
      await supabase
        .from('user_addresses')
        .update({ is_default: false })
        .eq('user_id', user.id);

      // Then set the new default
      const { error } = await supabase
        .from('user_addresses')
        .update({ is_default: true })
        .eq('id', addressId);

      if (error) throw error;

      toast({
        title: 'Default updated',
        description: 'Your default address has been changed',
      });

      fetchAddresses();
    } catch (error: any) {
      console.error('Set default error:', error);
      toast({
        title: 'Error',
        description: 'Failed to update default address',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  // ADDRESS LIST VIEW
  if (viewMode === 'list') {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 bg-background border-b border-border z-10 px-4 py-4 pt-safe">
          <div className="max-w-4xl mx-auto">
            <BackButton />
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 pt-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">My Addresses</h1>
              <p className="text-muted-foreground mt-2">Manage your delivery addresses</p>
            </div>
            <Button onClick={openAddDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Address
            </Button>
          </div>

          {addresses.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No addresses yet</h3>
                <p className="text-muted-foreground text-center mb-6">
                  Add your first delivery address to make checkout faster
                </p>
                <Button onClick={openAddDialog} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Address
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {addresses.map((address) => {
                const IconComponent = getAddressIcon(address.label, false);
                return (
                  <Card key={address.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <IconComponent className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">{address.label}</CardTitle>
                              {address.is_default && (
                                <Badge variant="secondary" className="gap-1">
                                  <Star className="h-3 w-3 fill-current" />
                                  Default
                                </Badge>
                              )}
                            </div>
                            <CardDescription className="mt-2">
                              {address.address_line1}
                              {address.address_line2 && <>, {address.address_line2}</>}
                              <br />
                              {address.city}
                              {address.postal_code && `, ${address.postal_code}`}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!address.is_default && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleSetDefault(address.id)}
                              title="Set as default"
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(address)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => confirmDeleteAddress(address)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          )}

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Address</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this address? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAddress} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }

  // ADD ADDRESS - SEARCH VIEW
  if (viewMode === 'add_search') {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 bg-background border-b border-border z-10 px-4 py-4 pt-safe">
          <div className="max-w-4xl mx-auto">
            <BackButton onClick={() => setViewMode('list')} />
            <h1 className="text-2xl font-bold text-foreground mt-4">Add New Address</h1>
            <p className="text-muted-foreground mt-1">Search for your address in Cyprus</p>
          </div>
        </div>
        
        <div className="max-w-4xl mx-auto px-4 pt-6">
          <AddressSearchPicker
            onAddressSelect={handleSearchAddressSelect}
            onUseCurrentLocation={handleCurrentLocationForAdd}
            isGettingLocation={gettingLocation}
            onManualPinClick={() => setViewMode('add_manual_map')}
          />
        </div>
      </div>
    );
  }

  // ADD ADDRESS - FULL SCREEN MAP VIEW
  if (viewMode === 'add_manual_map') {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col">
        {/* Back Button - Floating */}
        <div className="absolute top-4 left-4 z-10 pt-safe">
          <BackButton onClick={() => setViewMode('add_search')} />
        </div>

        {/* Current Location Button - Floating */}
        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => {
              if (!navigator.geolocation) return;
              setGettingLocation(true);
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  const { latitude, longitude } = position.coords;
                  setAddressForm(prev => ({
                    ...prev,
                    latitude,
                    longitude,
                  }));
                  setGettingLocation(false);
                },
                () => {
                  setGettingLocation(false);
                  toast({
                    title: 'Location error',
                    description: 'Could not get your current location.',
                    variant: 'destructive',
                  });
                },
                { enableHighAccuracy: true, timeout: 10000 }
              );
            }}
            disabled={gettingLocation}
            className="h-10 w-10 rounded-full shadow-lg"
          >
            {gettingLocation ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Navigation className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Full Screen Map */}
      <div className="flex-1 h-full w-full">
          <AddressMapPicker
            latitude={addressForm.latitude}
            longitude={addressForm.longitude}
            onLocationSelect={handleMapLocationSelect}
            height="100%"
            showCurrentLocationButton={false}
          />
        </div>

        {/* Bottom Panel */}
        <div className="bg-background border-t border-border p-4 space-y-3 animate-fade-in">
          {addressForm.latitude && addressForm.longitude ? (
            <>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {addressForm.address_line1 || 'Pin location selected'}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {addressForm.city ? `${addressForm.city}${addressForm.postal_code ? `, ${addressForm.postal_code}` : ''}` : 'Drag the pin to adjust position'}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setViewMode('add_manual_form')}
                className="w-full"
                size="lg"
              >
                Continue
              </Button>
            </>
          ) : (
            <div className="text-center py-2">
              <p className="text-muted-foreground">Tap on the map to pin your location</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ADD ADDRESS - MANUAL FORM VIEW (after pinning on map)
  if (viewMode === 'add_manual_form') {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 bg-background border-b border-border z-10 px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <BackButton onClick={() => setViewMode('add_search')} />
            <h1 className="text-2xl font-bold text-foreground mt-4">Confirm Address</h1>
            <p className="text-muted-foreground mt-1">Review and edit your address details</p>
          </div>
        </div>
        
        <div className="max-w-4xl mx-auto px-4 pt-6 space-y-4">
          {/* Mini Map Preview */}
          <div className="rounded-xl overflow-hidden">
            <AddressMapPicker
              latitude={addressForm.latitude}
              longitude={addressForm.longitude}
              onLocationSelect={handleMapLocationSelect}
              height="clamp(280px, 35vw, 400px)"
              showCurrentLocationButton={false}
            />
          </div>
          
          <div className="space-y-3">
            <div>
              <Label htmlFor="manual_address_line1">Street Address *</Label>
              <Input
                id="manual_address_line1"
                placeholder="e.g. Makarios Avenue 123"
                value={addressForm.address_line1}
                onChange={(e) => setAddressForm({ ...addressForm, address_line1: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="manual_address_line2">Apartment, Building, Floor (optional)</Label>
              <Input
                id="manual_address_line2"
                placeholder="e.g. Apt 4B, Floor 2"
                value={addressForm.address_line2}
                onChange={(e) => setAddressForm({ ...addressForm, address_line2: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="manual_city">City *</Label>
                <Input
                  id="manual_city"
                  placeholder="e.g. Nicosia"
                  value={addressForm.city}
                  onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="manual_postal_code">Postal Code</Label>
                <Input
                  id="manual_postal_code"
                  placeholder="e.g. 1010"
                  value={addressForm.postal_code}
                  onChange={(e) => setAddressForm({ ...addressForm, postal_code: e.target.value })}
                />
              </div>
            </div>
          </div>
          
          <Button
            type="button"
            onClick={() => {
              if (addressForm.address_line1 && addressForm.city) {
                setViewMode('add_label');
              }
            }}
            disabled={!addressForm.address_line1 || !addressForm.city}
            className="w-full"
            size="lg"
          >
            Continue
          </Button>
        </div>
      </div>
    );
  }

  // ADD ADDRESS - LABEL VIEW
  if (viewMode === 'add_label') {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 bg-background border-b border-border z-10 px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <BackButton onClick={() => {
              if (addressForm.latitude && addressForm.longitude) {
                setViewMode('add_manual_form');
              } else {
                setViewMode('add_search');
              }
            }} />
            <h1 className="text-2xl font-bold text-foreground mt-4">Label Address</h1>
            <p className="text-muted-foreground mt-1">Choose a label for this address</p>
          </div>
        </div>
        
        <div className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
          {/* Address Summary */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">{addressForm.address_line1}</p>
                  {addressForm.address_line2 && (
                    <p className="text-sm text-muted-foreground">{addressForm.address_line2}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {addressForm.city}{addressForm.postal_code && `, ${addressForm.postal_code}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address Name */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="address_label">Address Name *</Label>
              <Input
                id="address_label"
                placeholder="e.g. Home, Grandma's house, Warehouse, Beach Apartment"
                value={addressForm.label}
                onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value.slice(0, 40) })}
                maxLength={40}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">{addressForm.label.trim().length}/40</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {labelShortcuts.map((option) => {
                const Icon = option.icon;
                const isSelected = addressForm.label === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAddressForm({ ...addressForm, label: option.value })}
                    className={`px-4 py-2 rounded-full border transition-all duration-200 flex items-center gap-2 ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {option.value}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          
          <Button
            type="button"
            onClick={handleSaveAddress}
            disabled={!addressForm.label.trim()}
            className="w-full"
            size="lg"
          >
            Save Address
          </Button>
        </div>
      </div>
    );
  }

  // EDIT ADDRESS VIEW
  if (viewMode === 'edit') {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 bg-background border-b border-border z-10 px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <BackButton onClick={() => setViewMode('list')} />
            <h1 className="text-2xl font-bold text-foreground mt-4">Edit Address</h1>
            <p className="text-muted-foreground mt-1">Update your address details</p>
          </div>
        </div>
        
        <div className="max-w-4xl mx-auto px-4 pt-6 space-y-4">
          {/* Map */}
          <div className="rounded-xl overflow-hidden">
            <AddressMapPicker
              latitude={addressForm.latitude}
              longitude={addressForm.longitude}
              onLocationSelect={handleMapLocationSelect}
              height="clamp(300px, 40vw, 450px)"
              showCurrentLocationButton={true}
              onUseCurrentLocation={handleCurrentLocationForAdd}
              isGettingLocation={gettingLocation}
            />
          </div>

          {/* Address Name */}
          <div className="space-y-2">
            <Label htmlFor="edit_label">Address Name *</Label>
            <Input
              id="edit_label"
              placeholder="e.g. Home, Grandma's house, Warehouse, Beach Apartment"
              value={addressForm.label}
              onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value.slice(0, 40) })}
              maxLength={40}
              required
            />
            <p className="text-xs text-muted-foreground">{addressForm.label.trim().length}/40</p>
            <div className="flex flex-wrap gap-2">
              {labelShortcuts.map((option) => {
                const Icon = option.icon;
                const isSelected = addressForm.label === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAddressForm({ ...addressForm, label: option.value })}
                    className={`px-4 py-2 rounded-full border transition-all duration-200 flex items-center gap-2 ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {option.value}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit_address_line1">Street Address *</Label>
              <Input
                id="edit_address_line1"
                placeholder="e.g. Makarios Avenue 123"
                value={addressForm.address_line1}
                onChange={(e) => setAddressForm({ ...addressForm, address_line1: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit_address_line2">Apartment, Building, Floor (optional)</Label>
              <Input
                id="edit_address_line2"
                placeholder="e.g. Apt 4B, Floor 2"
                value={addressForm.address_line2}
                onChange={(e) => setAddressForm({ ...addressForm, address_line2: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit_city">City *</Label>
                <Input
                  id="edit_city"
                  placeholder="e.g. Nicosia"
                  value={addressForm.city}
                  onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_postal_code">Postal Code</Label>
                <Input
                  id="edit_postal_code"
                  placeholder="e.g. 1010"
                  value={addressForm.postal_code}
                  onChange={(e) => setAddressForm({ ...addressForm, postal_code: e.target.value })}
                />
              </div>
            </div>
          </div>
          
          <Button
            type="button"
            onClick={handleUpdateAddress}
            disabled={!addressForm.address_line1 || !addressForm.city || !addressForm.label.trim()}
            className="w-full"
            size="lg"
          >
            Update Address
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
