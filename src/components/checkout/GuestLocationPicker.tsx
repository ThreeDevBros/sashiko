import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, MapPin, Navigation, Search } from 'lucide-react';
import { MapLocationPicker } from '@/components/admin/MapLocationPicker';
import { toast } from 'sonner';

interface GuestLocationPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocationSelect: (location: { latitude: number; longitude: number; address: string }) => void;
  currentLocation?: { latitude: number; longitude: number; address: string } | null;
}

export const GuestLocationPicker = ({
  open,
  onOpenChange,
  onLocationSelect,
  currentLocation
}: GuestLocationPickerProps) => {
  const [step, setStep] = useState<'options' | 'search' | 'map'>('options');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [mapLocation, setMapLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>('');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('options');
      setSearchQuery('');
      setSearchResults([]);
      setMapLocation(null);
      setSelectedAddress('');
    }
  }, [open]);

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
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

      onLocationSelect({ latitude, longitude, address: addressString });
      onOpenChange(false);
      toast.success('Location set successfully');
    } catch (error) {
      console.error('Geolocation error:', error);
      toast.error('Could not get your location. Please check your permissions or search manually.');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`
      );
      const data = await response.json();
      setSearchResults(data);
      
      if (data.length === 0) {
        toast.error('No results found. Try a different search term.');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSearchResult = (result: any) => {
    setMapLocation({ 
      latitude: parseFloat(result.lat), 
      longitude: parseFloat(result.lon) 
    });
    setSelectedAddress(result.display_name);
    setStep('map');
  };

  const handleMapLocationSelect = (lat: number, lng: number) => {
    setMapLocation({ latitude: lat, longitude: lng });
  };

  const handleConfirmMapLocation = async () => {
    if (!mapLocation) return;

    try {
      // Reverse geocode to get address
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${mapLocation.latitude}&lon=${mapLocation.longitude}`
      );
      const data = await response.json();

      let addressString = selectedAddress || 'Selected Location';
      if (data.address) {
        const parts = [
          data.address.road || data.address.hamlet,
          data.address.suburb || data.address.neighbourhood,
          data.address.city || data.address.town || data.address.village
        ].filter(Boolean);
        addressString = parts.join(', ') || 'Selected Location';
      }

      onLocationSelect({ 
        latitude: mapLocation.latitude, 
        longitude: mapLocation.longitude, 
        address: addressString 
      });
      onOpenChange(false);
      toast.success('Delivery location set');
    } catch (error) {
      console.error('Geocoding error:', error);
      // Still allow if geocoding fails
      onLocationSelect({ 
        latitude: mapLocation.latitude, 
        longitude: mapLocation.longitude, 
        address: selectedAddress || 'Selected Location' 
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'options' && 'Set Delivery Location'}
            {step === 'search' && 'Search Address'}
            {step === 'map' && 'Confirm Location'}
          </DialogTitle>
          <DialogDescription>
            {step === 'options' && 'Choose how to set your delivery location'}
            {step === 'search' && 'Enter an address to find it on the map'}
            {step === 'map' && 'Tap to adjust the pin, then confirm'}
          </DialogDescription>
        </DialogHeader>

        {step === 'options' && (
          <div className="space-y-3">
            {/* Use Current Location */}
            <button
              type="button"
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:bg-accent/5 transition-colors text-left"
              onClick={handleUseCurrentLocation}
              disabled={gettingLocation}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Navigation className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Use Current Location</p>
                <p className="text-sm text-muted-foreground">
                  {gettingLocation ? 'Getting location...' : 'Detect automatically'}
                </p>
              </div>
              {gettingLocation && <Loader2 className="h-4 w-4 animate-spin" />}
            </button>

            {/* Search Address */}
            <button
              type="button"
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:bg-accent/5 transition-colors text-left"
              onClick={() => setStep('search')}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Search Address</p>
                <p className="text-sm text-muted-foreground">Find and select on map</p>
              </div>
            </button>

            {/* Pick on Map */}
            <button
              type="button"
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:bg-accent/5 transition-colors text-left"
              onClick={() => {
                // Default to current location's coordinates if available
                if (currentLocation) {
                  setMapLocation({ latitude: currentLocation.latitude, longitude: currentLocation.longitude });
                } else {
                  // Default to a central location (Cyprus)
                  setMapLocation({ latitude: 35.1264, longitude: 33.4299 });
                }
                setStep('map');
              }}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Pick on Map</p>
                <p className="text-sm text-muted-foreground">Select location manually</p>
              </div>
            </button>

            {currentLocation && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 mt-4">
                <p className="text-xs text-muted-foreground mb-1">Current selection:</p>
                <p className="text-sm font-medium">{currentLocation.address}</p>
              </div>
            )}
          </div>
        )}

        {step === 'search' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter address, city, or landmark..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {searchResults.map((result, index) => (
                  <button
                    key={index}
                    type="button"
                    className="w-full flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/5 transition-colors text-left"
                    onClick={() => handleSelectSearchResult(result)}
                  >
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{result.display_name}</span>
                  </button>
                ))}
              </div>
            )}

            <Button variant="outline" onClick={() => setStep('options')} className="w-full">
              Back
            </Button>
          </div>
        )}

        {step === 'map' && (
          <div className="space-y-4">
            <div className="h-[300px] rounded-lg overflow-hidden border">
              <MapLocationPicker
                initialLat={mapLocation?.latitude || null}
                initialLng={mapLocation?.longitude || null}
                onLocationSelect={handleMapLocationSelect}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('options')} className="flex-1">
                Back
              </Button>
              <Button onClick={handleConfirmMapLocation} className="flex-1" disabled={!mapLocation}>
                Confirm Location
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};