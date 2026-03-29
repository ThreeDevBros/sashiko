import { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { Search, MapPin, Navigation, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDetailedMapStyle } from '@/lib/mapStyles';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { LocationAutocompleteInput, type PlaceResult } from '@/components/LocationAutocompleteInput';
import { PinDropMapOverlay } from '@/components/PinDropMapOverlay';

interface SelectedAddress {
  address_line1: string;
  city: string;
  postal_code: string;
  latitude: number;
  longitude: number;
}

interface AddressSearchPickerProps {
  onAddressSelect: (address: SelectedAddress) => void;
  onUseCurrentLocation?: () => void;
  isGettingLocation?: boolean;
  onManualPinClick?: () => void;
}

export function AddressSearchPicker({
  onAddressSelect,
  onUseCurrentLocation,
  isGettingLocation = false,
  onManualPinClick,
}: AddressSearchPickerProps) {
  const { theme } = useTheme();
  const [selectedPlace, setSelectedPlace] = useState<SelectedAddress | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [pinMapOpen, setPinMapOpen] = useState(false);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    loadGoogleMaps(['maps', 'places'])
      .then(() => setMapsLoaded(true))
      .catch(() => setMapError(true));
  }, []);

  const handlePlaceSelect = useCallback((place: PlaceResult) => {
    const selected: SelectedAddress = {
      address_line1: place.addressLine1 || place.address,
      city: place.city || '',
      postal_code: place.postalCode || '',
      latitude: place.latitude,
      longitude: place.longitude,
    };

    setSelectedPlace(selected);
    setShowMap(true);
    setTimeout(() => initMap(place.latitude, place.longitude), 100);
  }, []);

  const initMap = (lat: number, lng: number) => {
    if (!mapContainer.current) return;

    const isDark = theme !== 'light';
    const mapStyles = getDetailedMapStyle(isDark);

    map.current = new google.maps.Map(mapContainer.current, {
      center: { lat, lng },
      zoom: 17,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      styles: mapStyles,
    });

    google.maps.event.addListenerOnce(map.current, 'idle', () => {
      map.current?.setOptions({ styles: mapStyles });
    });

    marker.current = new google.maps.Marker({
      position: { lat, lng },
      map: map.current,
      draggable: true,
    });

    marker.current.addListener('dragend', () => {
      const position = marker.current?.getPosition();
      if (position && selectedPlace) {
        setSelectedPlace({
          ...selectedPlace,
          latitude: position.lat(),
          longitude: position.lng(),
        });
      }
    });
  };

  const confirmAddress = () => {
    if (selectedPlace) {
      onAddressSelect(selectedPlace);
    }
  };

  const resetSearch = () => {
    setSelectedPlace(null);
    setShowMap(false);
    if (marker.current) marker.current.setMap(null);
    map.current = null;
  };

  if (mapError) {
    return (
      <div className="p-8 text-center border border-destructive/50 rounded-lg bg-destructive/10">
        <MapPin className="h-12 w-12 text-destructive mx-auto mb-4" />
        <p className="text-destructive font-semibold mb-2">Google Maps configuration error</p>
        <p className="text-sm text-muted-foreground">
          The address search feature requires a valid Google Maps API key.
          Please check the API key configuration in Settings.
        </p>
      </div>
    );
  }

  if (!mapsLoaded) {
    return (
      <div className="p-8 flex flex-col items-center justify-center border border-border rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading address search...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Native Google Autocomplete Search Input */}
      {!showMap && (
        <LocationAutocompleteInput
          onSelect={handlePlaceSelect}
          placeholder="Search for your address in Cyprus..."
          autoFocus
          onPinMapClick={() => {
            if (onManualPinClick) {
              onManualPinClick();
            } else {
              setPinMapOpen(true);
            }
          }}
        />
      )}

      {/* Current Location Button */}
      {!showMap && onUseCurrentLocation && (
        <Button
          type="button"
          variant="outline"
          onClick={onUseCurrentLocation}
          disabled={isGettingLocation}
          className="w-full gap-2"
        >
          {isGettingLocation ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
          {isGettingLocation ? 'Getting location...' : 'Use Current Location'}
        </Button>
      )}

      {/* Pin Drop Map Overlay (fallback when no onManualPinClick provided) */}
      <PinDropMapOverlay
        open={pinMapOpen}
        onClose={() => setPinMapOpen(false)}
        onConfirm={(place) => {
          const selected: SelectedAddress = {
            address_line1: place.addressLine1 || place.address,
            city: place.city || '',
            postal_code: place.postalCode || '',
            latitude: place.latitude,
            longitude: place.longitude,
          };
          setSelectedPlace(selected);
          setShowMap(true);
          setTimeout(() => initMap(place.latitude, place.longitude), 100);
        }}
      />

      {/* Map Preview */}
      {showMap && selectedPlace && (
        <div className="space-y-4">
          <div className="relative">
            <div
              ref={mapContainer}
              className="h-48 rounded-lg border border-border overflow-hidden"
            />
            <p className="text-xs text-muted-foreground text-center mt-2">
              Drag the pin to adjust your exact location
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <p className="font-medium text-foreground">{selectedPlace.address_line1}</p>
            <p className="text-sm text-muted-foreground">
              {[selectedPlace.city, selectedPlace.postal_code].filter(Boolean).join(', ')}
            </p>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={resetSearch} className="flex-1">
              Search Again
            </Button>
            <Button type="button" onClick={confirmAddress} className="flex-1">
              Confirm Location
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
