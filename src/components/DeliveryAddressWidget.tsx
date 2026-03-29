import { useState, useEffect } from 'react';
import { MapPin, ChevronDown, Navigation, Edit, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
interface LocalAddress {
  id: string;
  label: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  isCurrentLocation?: boolean;
}

export const DeliveryAddressWidget = () => {
  const [addresses, setAddresses] = useState<LocalAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [currentLocationData, setCurrentLocationData] = useState<{ latitude: number; longitude: number; address: string } | null>(null);
  const [formData, setFormData] = useState({
    label: '',
    address_line1: '',
    address_line2: '',
    city: '',
    postal_code: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    loadLocalAddresses();
  }, []);

  const loadLocalAddresses = () => {
    try {
      const savedAddresses = localStorage.getItem('localDeliveryAddresses');
      const addresses = savedAddresses ? JSON.parse(savedAddresses) : [];
      setAddresses(addresses);

      const savedAddressId = localStorage.getItem('selectedDeliveryAddress');
      if (savedAddressId === 'current-location') {
        setSelectedAddressId('current-location');
        // Try to load current location data
        const savedLocationData = localStorage.getItem('currentLocationData');
        if (savedLocationData) {
          setCurrentLocationData(JSON.parse(savedLocationData));
        }
      } else if (savedAddressId && addresses.find((a: LocalAddress) => a.id === savedAddressId)) {
        setSelectedAddressId(savedAddressId);
      } else if (addresses.length > 0) {
        setSelectedAddressId(addresses[0].id);
        localStorage.setItem('selectedDeliveryAddress', addresses[0].id);
      } else {
        // Default to current location
        setSelectedAddressId('current-location');
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
    }
  };

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Not supported',
        description: 'Geolocation is not supported by your browser.',
        variant: 'destructive',
      });
      return;
    }

    setGettingLocation(true);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
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
          localStorage.setItem('currentLocationData', JSON.stringify(locationData));
          setSelectedAddressId('current-location');
          localStorage.setItem('selectedDeliveryAddress', 'current-location');
          
          // Dispatch event
          window.dispatchEvent(new Event('addressChanged'));
          
          toast({
            title: 'Location updated',
            description: 'Using your current location',
          });
        } catch (error) {
          console.error('Error getting location:', error);
          toast({
            title: 'Error',
            description: 'Failed to get your location',
            variant: 'destructive',
          });
        } finally {
          setGettingLocation(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast({
          title: 'Location error',
          description: 'Could not get your location',
          variant: 'destructive',
        });
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleAddressSelect = (addressId: string) => {
    if (addressId === 'current-location') {
      getCurrentLocation();
      return;
    }
    
    setSelectedAddressId(addressId);
    localStorage.setItem('selectedDeliveryAddress', addressId);
    setIsOpen(false);
    
    window.dispatchEvent(new Event('addressChanged'));
    
    toast({
      title: 'Address updated',
      description: 'Your delivery address has been updated.'
    });
  };

  const saveManualAddress = () => {
    if (!formData.label || !formData.address_line1 || !formData.city) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    const newAddress: LocalAddress = {
      id: Date.now().toString(),
      ...formData
    };

    const updatedAddresses = [...addresses, newAddress];
    setAddresses(updatedAddresses);
    localStorage.setItem('localDeliveryAddresses', JSON.stringify(updatedAddresses));
    
    setSelectedAddressId(newAddress.id);
    localStorage.setItem('selectedDeliveryAddress', newAddress.id);
    
    window.dispatchEvent(new Event('addressChanged'));
    
    setDialogOpen(false);
    setFormData({
      label: '',
      address_line1: '',
      address_line2: '',
      city: '',
      postal_code: ''
    });
    
    toast({
      title: 'Address saved',
      description: 'Your address has been saved to this device',
    });
  };

  const getDisplayAddress = () => {
    if (selectedAddressId === 'current-location') {
      return currentLocationData ? currentLocationData.address : 'Getting location...';
    }
    const selected = addresses.find(a => a.id === selectedAddressId);
    return selected ? `${selected.address_line1}, ${selected.city}` : 'Select address';
  };
  return (
    <>
      <div className="max-w-md mx-auto px-5 pt-4">
        <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenu.Trigger asChild>
            <button className={`w-full flex items-center gap-2 px-3 py-2 bg-card/60 backdrop-blur-sm border border-border/30 shadow-sm hover:bg-card/80 transition-all ${
              isOpen ? 'rounded-t-xl border-b-0' : 'rounded-xl'
            }`}>
              {selectedAddressId === 'current-location' ? (
                <Navigation className="h-4 w-4 text-accent flex-shrink-0" />
              ) : (
                <MapPin className="h-4 w-4 text-accent flex-shrink-0" />
              )}
              <span className="flex-1 text-left text-sm text-foreground truncate">
                {getDisplayAddress()}
              </span>
              {gettingLocation && <Loader2 className="h-3 w-3 animate-spin" />}
              <ChevronDown className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content 
              className="z-50 w-[var(--radix-dropdown-menu-trigger-width)] bg-card/60 backdrop-blur-sm border border-t-0 border-border/30 rounded-b-xl shadow-lg p-2 origin-top overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1"
              sideOffset={0}
              align="start"
              style={{
                animationDuration: '500ms',
                animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <div className="py-1 max-h-[300px] overflow-y-auto">
                {/* Current Location Option */}
                {selectedAddressId !== 'current-location' && (
                  <DropdownMenu.Item
                    className="flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer outline-none hover:bg-accent/10 focus:bg-accent/10 transition-colors"
                    onSelect={() => handleAddressSelect('current-location')}
                  >
                    <Navigation className="h-4 w-4 text-primary mt-0.5" />
                    <div className="flex-1">
                      <span className="font-medium text-foreground text-sm">Current Location</span>
                      <p className="text-xs text-muted-foreground mt-1">
                        {currentLocationData ? currentLocationData.address : 'Use my current location'}
                      </p>
                    </div>
                  </DropdownMenu.Item>
                )}

                {/* Saved Addresses */}
                {addresses.filter(addr => addr.id !== selectedAddressId).map(address => (
                  <DropdownMenu.Item
                    key={address.id}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer outline-none hover:bg-accent/10 focus:bg-accent/10 transition-colors"
                    onSelect={() => handleAddressSelect(address.id)}
                  >
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <span className="font-medium text-foreground text-sm">{address.label}</span>
                      <p className="text-xs text-muted-foreground mt-1">
                        {address.address_line1}
                        {address.address_line2 && `, ${address.address_line2}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {address.city} {address.postal_code}
                      </p>
                    </div>
                  </DropdownMenu.Item>
                ))}
              </div>

              <DropdownMenu.Separator className="h-px bg-border my-2" />

              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer outline-none hover:bg-accent/10 focus:bg-accent/10 transition-colors"
                onSelect={() => {
                  setIsOpen(false);
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Add Manual Address</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Manual Address Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Delivery Address</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="label">Label *</Label>
              <Input
                id="label"
                placeholder="e.g., Home, Work"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_line1">Address Line 1 *</Label>
              <Input
                id="address_line1"
                placeholder="Street address"
                value={formData.address_line1}
                onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_line2">Address Line 2</Label>
              <Input
                id="address_line2"
                placeholder="Apt, suite, etc. (optional)"
                value={formData.address_line2}
                onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                placeholder="City"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="postal_code">Postal Code</Label>
              <Input
                id="postal_code"
                placeholder="Postal code (optional)"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={saveManualAddress} className="flex-1">
              Save Address
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground text-center">
            This address will be saved on your device only
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
};