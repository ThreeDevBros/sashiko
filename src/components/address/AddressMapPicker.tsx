import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadGoogleMaps } from '@/lib/googleMaps';

interface AddressMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onLocationSelect: (lat: number, lng: number, address?: string, city?: string, postalCode?: string) => void;
  onUseCurrentLocation?: () => void;
  isGettingLocation?: boolean;
  height?: string;
  showCurrentLocationButton?: boolean;
  addressToGeocode?: string;
  cityToGeocode?: string;
  postalCodeToGeocode?: string;
}

export function AddressMapPicker({
  latitude,
  longitude,
  onLocationSelect,
  onUseCurrentLocation,
  isGettingLocation = false,
  height = '200px',
  showCurrentLocationButton = true,
  addressToGeocode,
  cityToGeocode,
  postalCodeToGeocode,
}: AddressMapPickerProps) {
  
  const [googleMapsKey, setGoogleMapsKey] = useState<string>('');
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.Marker | null>(null);
  const geocodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastGeocodedRef = useRef<string>('');
  const lastCoordsRef = useRef<string>('');

  useEffect(() => {
    loadGoogleMaps(['maps', 'places']).then(key => {
      setGoogleMapsKey(key);
    }).catch(err => {
      console.error('Error loading Google Maps:', err);
      setMapError(true);
    });
  }, []);

  useEffect(() => {
    if (!googleMapsKey || !mapContainer.current) return;
    if (map.current) {
      // Map already initialized, just update center if we have coordinates
      if (latitude && longitude) {
        const pos = { lat: latitude, lng: longitude };
        map.current.setCenter(pos);
        map.current.setZoom(16);
        updateMarker(latitude, longitude);
      }
      return;
    }

    const initMap = async () => {
      try {
        createMap();
      } catch (error) {
        console.error('Error initializing map:', error);
        setMapError(true);
      }
    };

    initMap();

    return () => {
      if (marker.current) {
        marker.current.setMap(null);
      }
    };
  }, [googleMapsKey]);

  // Update map center when coordinates change externally (e.g., from GPS button)
  // Only reverse geocode if it's a NEW position change, not initial render
  const initialRenderRef = useRef(true);
  
  useEffect(() => {
    if (map.current && latitude && longitude) {
      const coordsKey = `${latitude},${longitude}`;
      const isNewCoords = lastCoordsRef.current !== coordsKey;
      lastCoordsRef.current = coordsKey;
      
      const pos = { lat: latitude, lng: longitude };
      map.current.setCenter(pos);
      map.current.setZoom(16);
      updateMarker(latitude, longitude);
      
      // Only reverse geocode if coordinates changed AFTER initial render
      // This prevents overwriting pre-filled address data
      if (isNewCoords && !initialRenderRef.current) {
        reverseGeocode(latitude, longitude);
      }
      initialRenderRef.current = false;
    }
  }, [latitude, longitude]);

  // Reset geocode cache when coordinates are cleared (user is editing address)
  useEffect(() => {
    if (!latitude && !longitude) {
      lastGeocodedRef.current = '';
    }
  }, [latitude, longitude]);

  // Satellite/hybrid maps don't need custom theme styles
  // Theme changes are only relevant for styled roadmap views

  const createMap = () => {
    if (!mapContainer.current) return;

    const center = latitude && longitude 
      ? { lat: latitude, lng: longitude }
      : { lat: 35.1856, lng: 33.3823 }; // Default to Cyprus

    map.current = new google.maps.Map(mapContainer.current, {
      center,
      zoom: latitude && longitude ? 16 : 10,
      mapTypeId: 'hybrid',
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      gestureHandling: 'greedy',
    });

    // No custom styles needed for satellite/hybrid view

    // Add click handler for map
    map.current.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        updateMarker(lat, lng);
        reverseGeocode(lat, lng);
      }
    });

    // Add initial marker if location exists
    if (latitude && longitude) {
      updateMarker(latitude, longitude);
    }

    setMapReady(true);
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ location: { lat, lng } });
      
      if (result.results && result.results.length > 0) {
        const place = result.results[0];
        
        // Extract address components
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

        // Build proper street address
        const streetAddress = streetNumber ? `${streetNumber} ${route}` : route || place.formatted_address?.split(',')[0] || '';
        
        onLocationSelect(lat, lng, streetAddress, city, postalCode);
      } else {
        onLocationSelect(lat, lng);
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      onLocationSelect(lat, lng);
    }
  };

  const updateMarker = (lat: number, lng: number) => {
    if (!map.current) return;

    // Remove old marker if exists
    if (marker.current) {
      marker.current.setMap(null);
    }

    // Create new draggable marker
    marker.current = new google.maps.Marker({
      position: { lat, lng },
      map: map.current,
      draggable: true,
    });

    // Handle marker drag events
    marker.current.addListener('dragend', async () => {
      const position = marker.current?.getPosition();
      if (position) {
        const newLat = position.lat();
        const newLng = position.lng();
        reverseGeocode(newLat, newLng);
      }
    });

    // Pan to the new location
    map.current.panTo({ lat, lng });
  };

  const performGeocode = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 5) return;
    if (!window.google?.maps) return;

    setIsGeocoding(true);
    
    try {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ address: searchQuery });
      
      if (result.results && result.results.length > 0) {
        const location = result.results[0].geometry.location;
        const lat = location.lat();
        const lng = location.lng();
        
        // Update marker and map
        if (map.current) {
          // Remove old marker
          if (marker.current) {
            marker.current.setMap(null);
          }
          
          // Create new marker
          marker.current = new google.maps.Marker({
            position: { lat, lng },
            map: map.current,
            draggable: true,
          });
          
          // Handle marker drag
          marker.current.addListener('dragend', async () => {
            const position = marker.current?.getPosition();
            if (position) {
              const newLat = position.lat();
              const newLng = position.lng();
              reverseGeocode(newLat, newLng);
            }
          });
          
          map.current.setCenter({ lat, lng });
          map.current.setZoom(16);
        }
        
        // Update coordinates only
        onLocationSelect(lat, lng);
        lastGeocodedRef.current = searchQuery;
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setIsGeocoding(false);
    }
  }, [onLocationSelect]);

  // Auto-geocode when address fields change
  useEffect(() => {
    // Build search query from address parts
    const addressParts = [addressToGeocode, postalCodeToGeocode, cityToGeocode].filter(Boolean);
    const searchQuery = addressParts.join(', ');
    
    // Need at least street address to search
    if (!addressToGeocode || addressToGeocode.length < 3) return;
    
    // Don't re-geocode the same query
    if (lastGeocodedRef.current === searchQuery) return;
    
    // Don't auto-geocode if we already have coordinates (user already pinned)
    if (latitude && longitude) return;
    
    // Clear previous timeout
    if (geocodeTimeoutRef.current) {
      clearTimeout(geocodeTimeoutRef.current);
    }
    
    // Wait for Google Maps to be ready
    if (!window.google?.maps) {
      // Retry when maps loads
      const checkInterval = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(checkInterval);
          performGeocode(searchQuery);
        }
      }, 200);
      setTimeout(() => clearInterval(checkInterval), 5000);
      return;
    }
    
    // Debounce geocoding - wait 600ms after user stops typing
    geocodeTimeoutRef.current = setTimeout(() => {
      performGeocode(searchQuery);
    }, 600);
    
    return () => {
      if (geocodeTimeoutRef.current) {
        clearTimeout(geocodeTimeoutRef.current);
      }
    };
  }, [addressToGeocode, cityToGeocode, postalCodeToGeocode, latitude, longitude, performGeocode]);

  if (mapError) {
    return (
      <div 
        className="bg-muted rounded-lg flex items-center justify-center border border-border"
        style={{ height }}
      >
        <div className="text-center p-4">
          <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Map unavailable</p>
        </div>
      </div>
    );
  }

  if (!googleMapsKey) {
    return (
      <div 
        className="bg-muted rounded-lg flex items-center justify-center border border-border"
        style={{ height }}
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={height === '100%' ? 'h-full flex flex-col' : 'space-y-3'}>
      {showCurrentLocationButton && onUseCurrentLocation && (
        <Button 
          type="button" 
          variant="outline" 
          onClick={onUseCurrentLocation}
          disabled={isGettingLocation || isGeocoding}
          className="w-full gap-2 py-3 h-12"
        >
          {isGettingLocation ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
          {isGettingLocation ? 'Getting location...' : 'Use Current Location'}
        </Button>
      )}
      
      <div className={height === '100%' ? 'relative flex-1' : 'relative'}>
        <div 
          ref={mapContainer} 
          className="rounded-lg overflow-hidden"
          style={{ height }}
        />
        {isGeocoding && (
          <div className="absolute inset-0 bg-background/50 rounded-lg flex items-center justify-center">
            <div className="flex items-center gap-2 bg-background px-3 py-2 rounded-full shadow-sm border">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Finding location...</span>
            </div>
          </div>
        )}
      </div>
      
      {latitude && longitude && (
        <p className="text-xs text-muted-foreground text-center">
          Drag the marker to adjust your exact location
        </p>
      )}
    </div>
  );
}
