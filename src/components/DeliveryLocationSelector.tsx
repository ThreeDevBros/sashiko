import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Navigation, ChevronRight, Plus, Loader2, Check, MapPinned } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { toast } from 'sonner';
import { getAddressIcon } from '@/lib/addressIcons';
import { LocationAutocompleteInput, type PlaceResult } from '@/components/LocationAutocompleteInput';
import { PinDropMapOverlay } from '@/components/PinDropMapOverlay';
import { STORAGE_KEYS } from '@/constants';

interface Address {
  id: string;
  label: string;
  address_line1: string;
  city: string;
  is_default: boolean;
  latitude?: number;
  longitude?: number;
}

export type LocationSource = 'device' | 'saved' | 'search' | 'pin';

export interface LocationSelection {
  /** New canonical field */
  source: LocationSource;
  /** Backward-compat alias: 'device' for device/search/pin, 'saved' for saved */
  type: 'device' | 'saved';
  address?: string;
  addressId?: string;
  latitude?: number;
  longitude?: number;
  label?: string;
}

interface DeliveryLocationSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocationSelect: (location: LocationSelection) => void;
  selectedType?: 'current-location' | 'selected-location' | string;
}

export const DeliveryLocationSelector = ({ 
  open, 
  onOpenChange,
  onLocationSelect,
  selectedType = 'current-location'
}: DeliveryLocationSelectorProps) => {
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [pinMapOpen, setPinMapOpen] = useState(false);

  // Load selected location data from localStorage
  const [selectedLocationData, setSelectedLocationData] = useState<{
    address: string; latitude: number; longitude: number;
  } | null>(null);

  useEffect(() => {
    if (open) {
      checkUserAndLoadAddresses();
      // Load selected location data
      const data = localStorage.getItem(STORAGE_KEYS.SELECTED_LOCATION_DATA);
      if (data) {
        try { setSelectedLocationData(JSON.parse(data)); } catch { setSelectedLocationData(null); }
      }
    }
  }, [open]);

  // Load device location data for display
  const [deviceLocationAddress, setDeviceLocationAddress] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_LOCATION_DATA);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          setDeviceLocationAddress(parsed.address || null);
        } catch { setDeviceLocationAddress(null); }
      } else {
        setDeviceLocationAddress(null);
      }
    }
  }, [open]);

  const checkUserAndLoadAddresses = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);

      if (session?.user) {
        const { data, error } = await supabase
          .from('user_addresses')
          .select('id, label, address_line1, city, is_default, latitude, longitude')
          .eq('user_id', session.user.id)
          .order('is_default', { ascending: false });

        if (!error && data) {
          setAddresses(data);
        }
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUseDeviceLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setGettingLocation(true);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          const { data, error } = await supabase.functions.invoke('geocode-location', {
            body: { latitude, longitude }
          });

          let addressString = 'Current location';
          if (!error && data?.address) {
            addressString = data.address;
          }

          onLocationSelect({ 
            source: 'device',
            type: 'device',
            address: addressString,
            latitude,
            longitude
          });
          onOpenChange(false);
          toast.success('Using your current location');
        } catch (error) {
          console.error('Error getting location:', error);
          toast.error('Failed to get your location');
        } finally {
          setGettingLocation(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast.error('Location access denied. Please enable location permissions.');
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSelectAddress = (address: Address) => {
    onLocationSelect({ 
      source: 'saved',
      type: 'saved',
      address: `${address.address_line1}, ${address.city}`,
      addressId: address.id,
      latitude: address.latitude,
      longitude: address.longitude,
      label: address.label
    });
    onOpenChange(false);
  };

  const handleSelectSelectedLocation = () => {
    if (!selectedLocationData) return;
    onLocationSelect({
      source: 'search',
      type: 'device',
      address: selectedLocationData.address,
      latitude: selectedLocationData.latitude,
      longitude: selectedLocationData.longitude,
      label: 'Selected Location',
    });
    onOpenChange(false);
  };

  const handleManageAddresses = () => {
    onOpenChange(false);
    navigate('/profile/address');
  };

  const handleOpenPinMap = () => {
    onOpenChange(false);
    setTimeout(() => setPinMapOpen(true), 300);
  };

  const hasSelectedLocation = !!selectedLocationData;

  return (
    <>
      <Drawer open={open && !pinMapOpen} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle>Delivery Location</DrawerTitle>
          </DrawerHeader>

          <div className="px-4 pb-6 space-y-2 overflow-y-auto">
            {/* Address Search */}
            <LocationAutocompleteInput
              onSelect={(place: PlaceResult) => {
                // Save as selected location
                const locData = {
                  address: place.address,
                  latitude: place.latitude,
                  longitude: place.longitude,
                };
                localStorage.setItem(STORAGE_KEYS.SELECTED_LOCATION_DATA, JSON.stringify(locData));
                setSelectedLocationData(locData);
                onLocationSelect({
                  source: 'search',
                  type: 'device',
                  address: place.address,
                  latitude: place.latitude,
                  longitude: place.longitude,
                  label: 'Selected Location',
                });
                onOpenChange(false);
                toast.success('Address selected');
              }}
              placeholder="Search for address, area, or district…"
              onPinMapClick={handleOpenPinMap}
            />

            {/* Device Location Option */}
            <button
              onClick={handleUseDeviceLocation}
              disabled={gettingLocation}
              className={`w-full flex items-center gap-3 p-4 rounded-xl transition-colors text-left ${
                selectedType === 'current-location' 
                  ? 'bg-primary/10 border-2 border-primary' 
                  : 'bg-primary/5 border border-primary/20 hover:bg-primary/10'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {gettingLocation ? (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                ) : (
                  <Navigation className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">Use Device Location</p>
                <p className="text-sm text-muted-foreground truncate">
                  {gettingLocation ? 'Getting location...' : 
                   (selectedType === 'current-location' && deviceLocationAddress) 
                     ? deviceLocationAddress 
                     : 'Automatically detect your location'}
                </p>
              </div>
              {selectedType === 'current-location' ? (
                <Check className="w-5 h-5 text-primary flex-shrink-0" />
              ) : (
                <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              )}
            </button>

            {/* Selected Location (from search/pin) */}
            {hasSelectedLocation && (
              <button
                onClick={handleSelectSelectedLocation}
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-colors text-left ${
                  selectedType === 'selected-location'
                    ? 'bg-primary/10 border-2 border-primary'
                    : 'bg-primary/5 border border-primary/20 hover:bg-primary/10'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  selectedType === 'selected-location' ? 'bg-primary/20' : 'bg-primary/10'
                }`}>
                  <MapPinned className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">Selected Location</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {selectedLocationData?.address || 'No address'}
                  </p>
                </div>
                {selectedType === 'selected-location' ? (
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                )}
              </button>
            )}

            {/* Divider */}
            {(addresses.length > 0 || user) && (
              <div className="relative py-3">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {addresses.length > 0 ? 'Saved Addresses' : 'No saved addresses'}
                  </span>
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Saved Addresses */}
            {!loading && addresses.map((address) => {
              const isSelected = selectedType === address.id;
              const AddressIcon = getAddressIcon(address.label, false);
              return (
                <button
                  key={address.id}
                  onClick={() => handleSelectAddress(address)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl transition-colors text-left ${
                    isSelected 
                      ? 'bg-primary/10 border-2 border-primary' 
                      : 'bg-card border border-border hover:bg-muted/50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-primary/20' : 'bg-muted'
                  }`}>
                    <AddressIcon className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-foreground'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{address.label}</p>
                      {address.is_default && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {address.address_line1}, {address.city}
                    </p>
                  </div>
                  {isSelected ? (
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
              );
            })}

            {/* Add/Manage Addresses */}
            {user && (
              <Button
                variant="outline"
                className="w-full mt-2 gap-2"
                onClick={handleManageAddresses}
              >
                <Plus className="w-4 h-4" />
                {addresses.length > 0 ? 'Manage Addresses' : 'Add New Address'}
              </Button>
            )}

            {/* Not logged in message */}
            {!loading && !user && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Sign in to save delivery addresses
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    navigate('/auth');
                  }}
                >
                  Sign In
                </Button>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <PinDropMapOverlay
        open={pinMapOpen}
        onClose={() => setPinMapOpen(false)}
        onConfirm={(place) => {
          setPinMapOpen(false);
          // Save as selected location
          const locData = {
            address: place.address,
            latitude: place.latitude,
            longitude: place.longitude,
          };
          localStorage.setItem(STORAGE_KEYS.SELECTED_LOCATION_DATA, JSON.stringify(locData));
          setSelectedLocationData(locData);
          onLocationSelect({
            source: 'pin',
            type: 'device',
            address: place.address,
            latitude: place.latitude,
            longitude: place.longitude,
            label: 'Pinned Location',
          });
          toast.success('Location pinned successfully');
        }}
      />
    </>
  );
};
