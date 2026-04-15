import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, MapPin, Navigation, Edit2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getCurrentPosition, isGeolocationAvailable } from '@/lib/geolocation';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { getMapStyle, darkMapStyle, lightMapStyle, createMarkerIcon } from '@/lib/mapStyles';

interface Address {
  id: string;
  label: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  postal_code?: string;
  is_default: boolean;
  latitude?: number;
  longitude?: number;
}

interface AddressSelectorProps {
  selectedAddressId: string | null;
  onAddressSelect: (addressId: string, locationData?: { latitude: number; longitude: number; address: string }) => void;
  showMap?: boolean;
}

export const AddressSelector = ({ selectedAddressId, onAddressSelect, showMap = false }: AddressSelectorProps) => {
  const { theme } = useTheme();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>('');
  const [currentLocationData, setCurrentLocationData] = useState<{ latitude: number; longitude: number; address: string } | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.Marker | null>(null);
  const [formValues, setFormValues] = useState({
    label: '',
    address_line1: '',
    address_line2: '',
    city: '',
    postal_code: '',
    latitude: null as number | null,
    longitude: null as number | null
  });
  const { toast } = useToast();

  const loadAddresses = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) return;

      const { data, error } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });

      if (error) throw error;

      setAddresses(data || []);
      
      // Auto-select default address if none selected
      if (!selectedAddressId && data && data.length > 0) {
        const defaultAddr = data.find(a => a.is_default) || data[0];
        onAddressSelect(defaultAddr.id);
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
    loadGoogleMapsApiKey();
  }, []);

  const loadGoogleMapsApiKey = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-public-keys', {
        body: { key_type: 'GOOGLE_MAPS_API_KEY' },
      });
      
      if (error) throw error;
      if (data?.key) {
        setGoogleMapsApiKey(data.key);
      }
    } catch (error) {
      console.error('Error loading Google Maps API key:', error);
    }
  };

  const getCurrentLocation = async () => {
    if (!isGeolocationAvailable()) {
      toast({
        title: 'Not supported',
        description: 'Geolocation is not supported by your browser.',
        variant: 'destructive',
      });
      return;
    }

    setGettingLocation(true);
    
    try {
      const position = await getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      const { latitude, longitude } = position.coords;
      
      // Use Nominatim (OpenStreetMap) for reverse geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
      );
      const data = await response.json();

      if (data.address) {
        setFormValues({
          label: 'Current Location',
          address_line1: data.address.road || data.address.suburb || '',
          address_line2: data.address.neighbourhood || '',
          city: data.address.city || data.address.town || data.address.village || '',
          postal_code: data.address.postcode || '',
          latitude,
          longitude
        });

        toast({
          title: 'Location found',
          description: 'Address fields have been filled with your current location.',
        });
      }
    } catch (error) {
      console.error('Geolocation error:', error);
      toast({
        title: 'Location access denied',
        description: 'Please enable location access in your browser settings.',
        variant: 'destructive',
      });
    } finally {
      setGettingLocation(false);
    }
  };

  const openEditDialog = (address: Address) => {
    setEditingAddress(address);
    setFormValues({
      label: address.label,
      address_line1: address.address_line1,
      address_line2: address.address_line2 || '',
      city: address.city,
      postal_code: address.postal_code || '',
      latitude: address.latitude || null,
      longitude: address.longitude || null
    });
    setDialogOpen(true);
  };

  const handleAddAddress = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('Auth error:', authError);
        toast({
          title: 'Authentication Error',
          description: 'Please sign in to save addresses.',
          variant: 'destructive',
        });
        return;
      }

      if (!user) {
        toast({
          title: 'Not authenticated',
          description: 'Please sign in to save addresses.',
          variant: 'destructive',
        });
        return;
      }

      // Validate required fields
      if (!formValues.label || !formValues.address_line1 || !formValues.city) {
        toast({
          title: 'Missing Information',
          description: 'Please fill in all required fields.',
          variant: 'destructive',
        });
        return;
      }

      if (editingAddress) {
        // Update existing address
        const { data, error } = await supabase
          .from('user_addresses')
          .update({
            label: formValues.label,
            address_line1: formValues.address_line1,
            address_line2: formValues.address_line2 || null,
            city: formValues.city,
            postal_code: formValues.postal_code || null,
            latitude: formValues.latitude,
            longitude: formValues.longitude,
          })
          .eq('id', editingAddress.id)
          .select()
          .single();

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Your delivery address has been updated.',
        });

        setAddresses(addresses.map(addr => addr.id === editingAddress.id ? data : addr));
      } else {
        // Add new address
        const newAddress = {
          user_id: user.id,
          label: formValues.label,
          address_line1: formValues.address_line1,
          address_line2: formValues.address_line2 || null,
          city: formValues.city,
          postal_code: formValues.postal_code || null,
          latitude: formValues.latitude,
          longitude: formValues.longitude,
          is_default: addresses.length === 0,
        };

        const { data, error } = await supabase
          .from('user_addresses')
          .insert(newAddress)
          .select()
          .single();

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Your delivery address has been saved.',
        });

        setAddresses([...addresses, data]);
        onAddressSelect(data.id);
      }

      setDialogOpen(false);
      setEditingAddress(null);
      setFormValues({
        label: '',
        address_line1: '',
        address_line2: '',
        city: '',
        postal_code: '',
        latitude: null,
        longitude: null
      });
    } catch (error: any) {
      console.error('Error saving address:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save address. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Map initialization and update
  useEffect(() => {
    if (!googleMapsApiKey || !mapContainer.current) return;

    const selectedAddress = addresses.find(addr => addr.id === selectedAddressId);
    if (!selectedAddress?.latitude || !selectedAddress?.longitude) return;

    const initMap = async () => {
      try {
        await loadGoogleMaps();

        // Initialize map if not exists
        const isDark = theme !== 'light';
        const mapStyles = getMapStyle(isDark);

        if (!map.current) {
          map.current = new google.maps.Map(mapContainer.current!, {
            center: { lat: selectedAddress.latitude!, lng: selectedAddress.longitude! },
            zoom: 15,
            disableDefaultUI: true,
            zoomControl: false,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            scaleControl: false,
            rotateControl: false,
            styles: mapStyles,
          });

          // Force re-apply styles after map is idle
          google.maps.event.addListenerOnce(map.current, 'idle', () => {
            map.current?.setOptions({ styles: mapStyles });
          });
        } else {
          // Update map center
          map.current.setCenter({ lat: selectedAddress.latitude!, lng: selectedAddress.longitude! });
        }

        // Update marker
        if (marker.current) {
          marker.current.setMap(null);
        }

        marker.current = new google.maps.Marker({
          position: { lat: selectedAddress.latitude!, lng: selectedAddress.longitude! },
          map: map.current,
          icon: createMarkerIcon('person'),
        });
      } catch (error) {
        console.error('Error loading Google Maps:', error);
      }
    };

    initMap();

    return () => {
      if (marker.current) {
        marker.current.setMap(null);
      }
    };
  }, [selectedAddressId, addresses, googleMapsApiKey]);

  // Update map styles when theme changes
  useEffect(() => {
    if (map.current && theme) {
      const isDark = theme !== 'light';
      map.current.setOptions({ styles: getMapStyle(isDark) });
    }
  }, [theme]);

  const useCurrentLocation = async () => {
    if (!isGeolocationAvailable()) {
      toast({
        title: 'Not supported',
        description: 'Geolocation is not supported by your browser.',
        variant: 'destructive',
      });
      return;
    }

    setGettingLocation(true);
    
    try {
      const position = await getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      const { latitude, longitude } = position.coords;
      
      // Use Nominatim for reverse geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
      );
      const data = await response.json();

      let addressString = 'Current Location';
      if (data.address) {
        const parts = [
          data.address.road || data.address.hamlet,
          data.address.suburb || data.address.neighbourhood,
          data.address.city || data.address.town || data.address.village
        ].filter(Boolean);
        addressString = parts.join(', ') || 'Current Location';
      }

      const locationData = { latitude, longitude, address: addressString };
      setCurrentLocationData(locationData);
      onAddressSelect('current-location', locationData);
      
      toast({
        title: 'Location found',
        description: 'Using your current location for delivery',
      });
    } catch (error) {
      console.error('Geolocation error:', error);
      toast({
        title: 'Location error',
        description: 'Could not get your location. Please check your permissions.',
        variant: 'destructive',
      });
    } finally {
      setGettingLocation(false);
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading addresses...</div>;
  }

  const selectedAddress = addresses.find(addr => addr.id === selectedAddressId);
  const canShowMap = googleMapsApiKey && selectedAddress?.latitude && selectedAddress?.longitude;

  return (
    <div className="space-y-4">
      <RadioGroup value={selectedAddressId || ''} onValueChange={(value) => onAddressSelect(value)}>
        <div className="space-y-3">
          {/* Current Location Option */}
          <div className="relative">
            <RadioGroupItem value="current-location" id="current-location" className="peer sr-only" />
            <Label
              htmlFor="current-location"
              className="flex items-start gap-3 rounded-xl border-2 border-white/30 backdrop-blur-sm bg-white/40 p-4 hover:bg-white/60 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 cursor-pointer transition-all"
              onClick={(e) => {
                if (selectedAddressId !== 'current-location') {
                  e.preventDefault();
                  useCurrentLocation();
                }
              }}
            >
              <Navigation className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold flex items-center gap-2">
                  Current Location
                  {gettingLocation && <Loader2 className="w-3 h-3 animate-spin" />}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {currentLocationData ? currentLocationData.address : 'Use my current location'}
                </div>
              </div>
            </Label>
          </div>

          {/* Saved Addresses */}
          {addresses.length > 0 && addresses.map((address) => (
              <div key={address.id} className="relative">
                <RadioGroupItem value={address.id} id={address.id} className="peer sr-only" />
                <Label
                  htmlFor={address.id}
                  className="flex items-start gap-3 rounded-xl border-2 border-white/30 backdrop-blur-sm bg-white/40 p-4 hover:bg-white/60 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 cursor-pointer transition-all"
                >
                  <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold flex items-center gap-2">
                      {address.label}
                      {address.is_default && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {address.address_line1}
                      {address.address_line2 && `, ${address.address_line2}`}
                      <br />
                      {address.city}
                      {address.postal_code && `, ${address.postal_code}`}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={(e) => {
                      e.preventDefault();
                      openEditDialog(address);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </Label>
              </div>
            ))}
        </div>
      </RadioGroup>
      
      {addresses.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No saved addresses yet</p>
          <p className="text-sm">Add your first delivery address below</p>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setEditingAddress(null);
          setFormValues({
            label: '',
            address_line1: '',
            address_line2: '',
            city: '',
            postal_code: '',
            latitude: null,
            longitude: null
          });
        }
      }}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add New Address
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAddress ? 'Edit Delivery Address' : 'Add Delivery Address'}</DialogTitle>
          </DialogHeader>
          
          <div className="mb-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={getCurrentLocation}
              disabled={gettingLocation}
            >
              <Navigation className="h-4 w-4 mr-2" />
              {gettingLocation ? 'Getting location...' : 'Use Current Location'}
            </Button>
          </div>

          <form onSubmit={handleAddAddress} className="space-y-4">
            <div>
              <Label htmlFor="label">Address Label *</Label>
              <Input
                id="label"
                name="label"
                placeholder="e.g., Home, Office, Mom's House"
                value={formValues.label}
                onChange={(e) => setFormValues({ ...formValues, label: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="address_line1">Street Address *</Label>
              <Input
                id="address_line1"
                name="address_line1"
                placeholder="123 Main Street"
                value={formValues.address_line1}
                onChange={(e) => setFormValues({ ...formValues, address_line1: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="address_line2">Apartment, Suite, etc.</Label>
              <Input
                id="address_line2"
                name="address_line2"
                placeholder="Apt 4B"
                value={formValues.address_line2}
                onChange={(e) => setFormValues({ ...formValues, address_line2: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  name="city"
                  placeholder="New York"
                  value={formValues.city}
                  onChange={(e) => setFormValues({ ...formValues, city: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="postal_code">Postal Code</Label>
                <Input
                  id="postal_code"
                  name="postal_code"
                  placeholder="10001"
                  value={formValues.postal_code}
                  onChange={(e) => setFormValues({ ...formValues, postal_code: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" className="w-full">
              {editingAddress ? 'Update Address' : 'Save Address'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Map Display */}
      {showMap && canShowMap && (
        <div className="mt-4 rounded-lg overflow-hidden border-2 border-primary/20">
          <div ref={mapContainer} className="w-full h-[300px]" />
        </div>
      )}
    </div>
  );
};
