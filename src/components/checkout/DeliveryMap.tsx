import { useEffect, useRef, useState, memo } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { getMapStyle, createMarkerIcon, waitForContainerReady, triggerMapResize } from '@/lib/mapStyles';
import { STORAGE_KEYS } from '@/constants';
import { loadGoogleMaps } from '@/lib/googleMaps';

interface DeliveryMapProps {
  selectedAddressId: string | null;
  addresses: Array<{
    id: string;
    latitude?: number;
    longitude?: number;
  }>;
  restaurantLocation?: {
    latitude: number;
    longitude: number;
    name: string;
  };
  deliveryRadiusKm?: number;
  showRadiusRing?: boolean;
  pickupMode?: boolean;
}

function DeliveryMapComponent({ selectedAddressId, addresses, restaurantLocation, deliveryRadiusKm, showRadiusRing = false, pickupMode = false }: DeliveryMapProps) {
  const { theme } = useTheme();
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>('');
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const deliveryMarker = useRef<google.maps.Marker | null>(null);
  const restaurantMarker = useRef<google.maps.Marker | null>(null);
  const radiusCircle = useRef<google.maps.Circle | null>(null);

  useEffect(() => {
    loadGoogleMaps(['maps']).then(key => {
      setGoogleMapsApiKey(key);
    }).catch(err => {
      console.error('Failed to load Google Maps:', err);
    });
  }, []);

  // Get coordinates based on selected address type
  const getDeliveryCoordinates = (): { latitude: number; longitude: number } | null => {
    // Handle current location from localStorage
    if (selectedAddressId === 'current-location') {
      const savedLocationData = localStorage.getItem(STORAGE_KEYS.CURRENT_LOCATION_DATA);
      if (savedLocationData) {
        try {
          const parsed = JSON.parse(savedLocationData);
          if (parsed.latitude && parsed.longitude) {
            return { latitude: parsed.latitude, longitude: parsed.longitude };
          }
        } catch {
          console.log('DeliveryMap: Error parsing current location data');
        }
      }
      return null;
    }

    // Handle selected location (search/pin) from localStorage
    if (selectedAddressId === 'selected-location') {
      const savedSelectedData = localStorage.getItem(STORAGE_KEYS.SELECTED_LOCATION_DATA);
      if (savedSelectedData) {
        try {
          const parsed = JSON.parse(savedSelectedData);
          if (parsed.latitude && parsed.longitude) {
            return { latitude: parsed.latitude, longitude: parsed.longitude };
          }
        } catch {
          console.log('DeliveryMap: Error parsing selected location data');
        }
      }
      return null;
    }

    // Handle saved addresses
    const selectedAddress = addresses.find(addr => addr.id === selectedAddressId);
    if (selectedAddress?.latitude && selectedAddress?.longitude) {
      return { latitude: selectedAddress.latitude, longitude: selectedAddress.longitude };
    }

    return null;
  };

  // Initialize and update map when selected address changes
  useEffect(() => {
    if (!googleMapsApiKey) return;
    if (!mapContainer.current) return;

    // In pickup mode, we only need restaurant location
    if (pickupMode) {
      if (!restaurantLocation) return;
    } else {
      const deliveryCoords = getDeliveryCoordinates();
      if (!deliveryCoords) return;
    }

    const initMap = async () => {
      try {
        // Wait for container to be visible (mobile fix)
        if (mapContainer.current) {
          await waitForContainerReady(mapContainer.current, 3000);
        }

        const isDark = theme !== 'light';
        const mapStyles = getMapStyle(isDark);
        const deliveryCoords = pickupMode ? null : getDeliveryCoordinates();

        const centerLat = pickupMode ? restaurantLocation!.latitude : deliveryCoords!.latitude;
        const centerLng = pickupMode ? restaurantLocation!.longitude : deliveryCoords!.longitude;
        const initialZoom = pickupMode ? 14 : 13;

        if (!map.current && mapContainer.current) {
          map.current = new google.maps.Map(mapContainer.current, {
            center: { lat: centerLat, lng: centerLng },
            zoom: initialZoom,
            disableDefaultUI: true,
            clickableIcons: false,
            gestureHandling: 'none',
            draggable: false,
            scrollwheel: false,
            disableDoubleClickZoom: true,
            keyboardShortcuts: false,
            draggableCursor: 'default',
            draggingCursor: 'default',
            zoomControl: false,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            scaleControl: false,
            rotateControl: false,
            styles: mapStyles,
          });

          google.maps.event.addListenerOnce(map.current, 'idle', () => {
            map.current?.setOptions({ styles: mapStyles });
          });

          triggerMapResize(map.current);
        } else if (map.current) {
          map.current.setCenter({ lat: centerLat, lng: centerLng });
          map.current.setZoom(initialZoom);
          map.current.setOptions({ styles: mapStyles });
        }

        // Delivery marker — only in delivery mode
        if (deliveryMarker.current) {
          deliveryMarker.current.setMap(null);
          deliveryMarker.current = null;
        }
        if (!pickupMode && deliveryCoords) {
          deliveryMarker.current = new google.maps.Marker({
            position: { lat: deliveryCoords.latitude, lng: deliveryCoords.longitude },
            map: map.current,
            icon: createMarkerIcon('person'),
            title: 'Delivery Address',
          });
        }

        // Restaurant marker
        if (restaurantLocation && map.current) {
          if (restaurantMarker.current) {
            restaurantMarker.current.setMap(null);
          }

          restaurantMarker.current = new google.maps.Marker({
            position: { lat: restaurantLocation.latitude, lng: restaurantLocation.longitude },
            map: map.current,
            icon: createMarkerIcon('restaurant'),
            title: restaurantLocation.name,
          });

          // Delivery radius circle
          if (showRadiusRing && deliveryRadiusKm && deliveryRadiusKm > 0) {
            if (radiusCircle.current) {
              radiusCircle.current.setCenter({ lat: restaurantLocation.latitude, lng: restaurantLocation.longitude });
              radiusCircle.current.setRadius(deliveryRadiusKm * 1000);
            } else {
              radiusCircle.current = new google.maps.Circle({
                map: map.current,
                center: { lat: restaurantLocation.latitude, lng: restaurantLocation.longitude },
                radius: deliveryRadiusKm * 1000,
                strokeColor: '#FF7A00',
                strokeOpacity: 0.7,
                strokeWeight: 2,
                fillColor: '#FF7A00',
                fillOpacity: 0.12,
                zIndex: 1,
                clickable: false,
              });
            }
          } else if (radiusCircle.current) {
            radiusCircle.current.setMap(null);
            radiusCircle.current = null;
          }

          // Fit bounds only in delivery mode (both markers)
          if (!pickupMode && deliveryCoords) {
            const bounds = new google.maps.LatLngBounds();
            bounds.extend({ lat: restaurantLocation.latitude, lng: restaurantLocation.longitude });
            bounds.extend({ lat: deliveryCoords.latitude, lng: deliveryCoords.longitude });
            map.current.fitBounds(bounds);
            
            setTimeout(() => {
              if (map.current) {
                const currentZoom = map.current.getZoom();
                if (currentZoom && currentZoom > 15) {
                  map.current.setZoom(15);
                }
              }
            }, 100);
          }
        } else if (!pickupMode) {
          map.current?.setCenter({ lat: centerLat, lng: centerLng });
          map.current?.setZoom(15);
        }
      } catch (error) {
        console.error('Error loading Google Maps:', error);
      }
    };

    initMap();

    return () => {
      if (deliveryMarker.current) {
        deliveryMarker.current.setMap(null);
      }
      if (restaurantMarker.current) {
        restaurantMarker.current.setMap(null);
      }
      if (radiusCircle.current) {
        radiusCircle.current.setMap(null);
      }
    };
  }, [selectedAddressId, addresses, googleMapsApiKey, restaurantLocation, showRadiusRing, deliveryRadiusKm, pickupMode]);

  // Update map styles when theme changes
  useEffect(() => {
    if (map.current && theme) {
      const isDark = theme !== 'light';
      map.current.setOptions({ styles: getMapStyle(isDark) });
    }
  }, [theme]);

  const deliveryCoords = getDeliveryCoordinates();
  const showMap = pickupMode
    ? (googleMapsApiKey && restaurantLocation)
    : (googleMapsApiKey && deliveryCoords);

  if (!showMap) {
    return null;
  }

  return (
    <div className="rounded-lg overflow-hidden border-2 border-primary/20 pointer-events-none">
      <div ref={mapContainer} className="w-full h-[300px]" />
    </div>
  );
}

// Memoize to prevent re-renders when parent state changes (like payment method)
export const DeliveryMap = memo(DeliveryMapComponent, (prevProps, nextProps) => {
  return (
    prevProps.selectedAddressId === nextProps.selectedAddressId &&
    prevProps.restaurantLocation?.latitude === nextProps.restaurantLocation?.latitude &&
    prevProps.restaurantLocation?.longitude === nextProps.restaurantLocation?.longitude &&
    prevProps.addresses.length === nextProps.addresses.length &&
    prevProps.deliveryRadiusKm === nextProps.deliveryRadiusKm &&
    prevProps.showRadiusRing === nextProps.showRadiusRing &&
    prevProps.pickupMode === nextProps.pickupMode
  );
});
