import { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { MapPin, Loader2 } from 'lucide-react';
import { getMapStyle } from '@/lib/mapStyles';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { LocationAutocompleteInput, type PlaceResult } from '@/components/LocationAutocompleteInput';

interface MapLocationPickerProps {
  initialLat?: number | null;
  initialLng?: number | null;
  onLocationSelect: (lat: number, lng: number, address?: string, city?: string, placeId?: string) => void;
  deliveryRadiusKm?: number;
  useSatellite?: boolean;
}

export function MapLocationPicker({ initialLat, initialLng, onLocationSelect, deliveryRadiusKm = 5, useSatellite = false }: MapLocationPickerProps) {
  const { theme } = useTheme();
  const [googleMapsKey, setGoogleMapsKey] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.Marker | null>(null);
  const circle = useRef<google.maps.Circle | null>(null);

  // Notify parent of initial coordinates
  useEffect(() => {
    if (initialLat && initialLng) {
      onLocationSelect(initialLat, initialLng);
    }
  }, []);

  useEffect(() => {
    loadGoogleMaps(['maps', 'places']).then(key => {
      setGoogleMapsKey(key);
    }).catch(err => {
      console.error('Error loading Google Maps:', err);
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!googleMapsKey || !mapContainer.current || map.current) return;

    const center = selectedLocation
      ? { lat: selectedLocation.lat, lng: selectedLocation.lng }
      : { lat: 35.1856, lng: 33.3823 };

    const isDark = theme !== 'light';
    const mapStyles = getMapStyle(isDark);

    map.current = new google.maps.Map(mapContainer.current!, {
      center,
      zoom: selectedLocation ? 15 : 10,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      ...(useSatellite
        ? { mapTypeId: 'satellite', tilt: 0 }
        : { styles: mapStyles }),
    });

    google.maps.event.addListenerOnce(map.current, 'idle', () => {
      map.current?.setOptions({ styles: mapStyles });
    });

    map.current.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        updateMarker(e.latLng.lat(), e.latLng.lng());
      }
    });

    if (selectedLocation) {
      updateMarker(selectedLocation.lat, selectedLocation.lng);
    }

    return () => {
      if (marker.current) marker.current.setMap(null);
      if (circle.current) circle.current.setMap(null);
    };
  }, [googleMapsKey]);

  // Update map styles when theme changes (skip for satellite)
  useEffect(() => {
    if (map.current && theme && !useSatellite) {
      const isDark = theme !== 'light';
      map.current.setOptions({ styles: getMapStyle(isDark) });
    }
  }, [theme, useSatellite]);

  const handlePlaceSelect = useCallback((place: PlaceResult) => {
    const lat = place.latitude;
    const lng = place.longitude;
    setSelectedLocation({ lat, lng });

    // Place marker without triggering reverse geocode
    if (marker.current) marker.current.setMap(null);
    marker.current = new google.maps.Marker({
      position: { lat, lng },
      map: map.current!,
      draggable: true,
    });
    marker.current.addListener('dragend', async () => {
      const position = marker.current?.getPosition();
      if (position) {
        const newLat = position.lat();
        const newLng = position.lng();
        setSelectedLocation({ lat: newLat, lng: newLng });
        const { address, city } = await reverseGeocode(newLat, newLng);
        onLocationSelect(newLat, newLng, address, city);
        updateRadiusCircle(newLat, newLng);
      }
    });

    updateRadiusCircle(lat, lng);
    map.current?.panTo({ lat, lng });
    map.current?.setZoom(17);

    // Use address/city directly from Places API
    onLocationSelect(lat, lng, place.address, place.city || '', place.placeId || '');
  }, [onLocationSelect, googleMapsKey]);

  const reverseGeocode = async (lat: number, lng: number) => {
    if (!googleMapsKey) return { address: '', city: '' };
    try {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ location: { lat, lng } });
      if (result.results?.length > 0) {
        const place = result.results[0];
        const address = place.formatted_address || '';
        const cityComponent = place.address_components?.find((comp) =>
          comp.types.includes('locality') || comp.types.includes('administrative_area_level_1')
        );
        const city = cityComponent?.long_name || '';
        return { address, city };
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
    return { address: '', city: '' };
  };

  const updateMarker = async (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng });
    if (marker.current) marker.current.setMap(null);

    marker.current = new google.maps.Marker({
      position: { lat, lng },
      map: map.current!,
      draggable: true,
    });

    marker.current.addListener('dragend', async () => {
      const position = marker.current?.getPosition();
      if (position) {
        const newLat = position.lat();
        const newLng = position.lng();
        setSelectedLocation({ lat: newLat, lng: newLng });
        const { address, city } = await reverseGeocode(newLat, newLng);
        onLocationSelect(newLat, newLng, address, city);
        updateRadiusCircle(newLat, newLng);
      }
    });

    updateRadiusCircle(lat, lng);
    map.current?.panTo({ lat, lng });
    map.current?.setZoom(15);

    const { address, city } = await reverseGeocode(lat, lng);
    onLocationSelect(lat, lng, address, city);
  };

  const updateRadiusCircle = (lat: number, lng: number) => {
    if (!map.current) return;
    if (circle.current) circle.current.setMap(null);

    circle.current = new google.maps.Circle({
      map: map.current,
      center: { lat, lng },
      radius: deliveryRadiusKm * 1000,
      fillColor: '#4CAF50',
      fillOpacity: 0.2,
      strokeColor: '#4CAF50',
      strokeWeight: 2,
      clickable: false,
    });
  };

  useEffect(() => {
    if (selectedLocation) {
      updateRadiusCircle(selectedLocation.lat, selectedLocation.lng);
    }
  }, [deliveryRadiusKm]);

  if (!googleMapsKey) {
    return (
      <div className="h-[500px] bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground">Configure Google Maps API key in admin settings to use the map.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Native Google Autocomplete */}
      <LocationAutocompleteInput
        onSelect={handlePlaceSelect}
        placeholder="Search for restaurant or address..."
      />

      <div ref={mapContainer} className="h-[500px] rounded-lg border border-border" />

      {selectedLocation && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>
            Selected: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
          </span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Search for a restaurant or address, or click on the map to select a location. You can drag the marker to fine-tune the position.
      </p>
    </div>
  );
}
