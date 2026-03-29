import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/components/ThemeProvider';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, Navigation, Clock } from 'lucide-react';
import { getMapStyle, createMarkerIcon, waitForContainerReady, triggerMapResize } from '@/lib/mapStyles';
import { loadGoogleMaps } from '@/lib/googleMaps';

interface LiveDeliveryMapProps {
  orderId: string;
  deliveryAddress: {
    latitude: number;
    longitude: number;
    address_line1: string;
    city: string;
  };
  restaurantLocation: {
    latitude: number;
    longitude: number;
    name: string;
  };
}

interface DriverLocation {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  updated_at: string;
}

export function LiveDeliveryMap({ orderId, deliveryAddress, restaurantLocation }: LiveDeliveryMapProps) {
  const { theme } = useTheme();
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>('');
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<string>('');
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const driverMarker = useRef<google.maps.Marker | null>(null);
  const deliveryMarker = useRef<google.maps.Marker | null>(null);
  const restaurantMarker = useRef<google.maps.Marker | null>(null);
  const directionsRenderer = useRef<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    loadGoogleMaps(['maps', 'routes']).then(key => {
      setGoogleMapsApiKey(key);
    }).catch(err => {
      console.error('Error loading Google Maps:', err);
    });
  }, []);

  // Subscribe to real-time driver location updates
  useEffect(() => {
    const channel = supabase
      .channel(`driver-location-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_locations',
          filter: `order_id=eq.${orderId}`
        },
        (payload) => {
          console.log('Driver location update:', payload);
          if (payload.new) {
            const newLocation = payload.new as any;
            setDriverLocation({
              latitude: typeof newLocation.latitude === 'string' 
                ? parseFloat(newLocation.latitude) 
                : newLocation.latitude,
              longitude: typeof newLocation.longitude === 'string' 
                ? parseFloat(newLocation.longitude) 
                : newLocation.longitude,
              heading: newLocation.heading ? (
                typeof newLocation.heading === 'string' 
                  ? parseFloat(newLocation.heading) 
                  : newLocation.heading
              ) : undefined,
              speed: newLocation.speed ? (
                typeof newLocation.speed === 'string' 
                  ? parseFloat(newLocation.speed) 
                  : newLocation.speed
              ) : undefined,
              updated_at: newLocation.updated_at
            });
          }
        }
      )
      .subscribe();

    // Load initial driver location
    loadDriverLocation();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const loadDriverLocation = async () => {
    try {
      const { data, error } = await supabase
        .from('driver_locations')
        .select('*')
        .eq('order_id', orderId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      if (data) {
        setDriverLocation({
          latitude: typeof data.latitude === 'string' 
            ? parseFloat(data.latitude) 
            : data.latitude,
          longitude: typeof data.longitude === 'string' 
            ? parseFloat(data.longitude) 
            : data.longitude,
          heading: data.heading ? (
            typeof data.heading === 'string' 
              ? parseFloat(data.heading) 
              : data.heading
          ) : undefined,
          speed: data.speed ? (
            typeof data.speed === 'string' 
              ? parseFloat(data.speed) 
              : data.speed
          ) : undefined,
          updated_at: data.updated_at
        });
      }
    } catch (error) {
      console.error('Error loading driver location:', error);
    }
  };

  // Initialize map and update when driver location changes
  useEffect(() => {
    if (!googleMapsApiKey || !mapContainer.current || !driverLocation) return;

    const initMap = async () => {
      try {
        // Wait for container to be ready on mobile
        if (mapContainer.current) {
          await waitForContainerReady(mapContainer.current, 3000);
        }

        // Initialize map if not exists
        if (!map.current) {
          const isDark = theme !== 'light';
          const mapStyles = getMapStyle(isDark);
          
          map.current = new google.maps.Map(mapContainer.current!, {
            center: { lat: driverLocation.latitude, lng: driverLocation.longitude },
            zoom: 14,
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

          triggerMapResize(map.current);

          directionsRenderer.current = new google.maps.DirectionsRenderer({
            map: map.current,
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: '#3b82f6',
              strokeWeight: 5,
              strokeOpacity: 0.8,
            },
          });
        }

        // Update driver marker
        if (driverMarker.current) {
          driverMarker.current.setMap(null);
        }

        driverMarker.current = new google.maps.Marker({
          position: { lat: driverLocation.latitude, lng: driverLocation.longitude },
          map: map.current,
          icon: createMarkerIcon('driver'),
          title: 'Driver Location',
        });

        // Add delivery marker if not exists
        if (!deliveryMarker.current) {
          deliveryMarker.current = new google.maps.Marker({
            position: { lat: deliveryAddress.latitude, lng: deliveryAddress.longitude },
            map: map.current,
            icon: createMarkerIcon('person'),
            title: 'Delivery Address',
          });
        }

        // Get and display route from driver to delivery
        const directionsService = new google.maps.DirectionsService();
        directionsService.route(
          {
            origin: { lat: driverLocation.latitude, lng: driverLocation.longitude },
            destination: { lat: deliveryAddress.latitude, lng: deliveryAddress.longitude },
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (status === 'OK' && result) {
              directionsRenderer.current?.setDirections(result);
              
              // Calculate estimated time
              const route = result.routes[0];
              if (route && route.legs[0]) {
                setEstimatedTime(route.legs[0].duration?.text || '');
              }
            }
          }
        );
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initMap();
  }, [googleMapsApiKey, driverLocation, deliveryAddress]);

  // Update map styles when theme changes
  useEffect(() => {
    if (map.current && theme) {
      const isDark = theme !== 'light';
      map.current.setOptions({ styles: getMapStyle(isDark) });
    }
  }, [theme]);

  if (!driverLocation) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Truck className="h-5 w-5 animate-pulse" />
          <p>Waiting for driver to start delivery...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <Truck className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Driver Status</p>
              <p className="font-semibold">On the way</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estimated Time</p>
              <p className="font-semibold">{estimatedTime || 'Calculating...'}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Navigation className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Speed</p>
              <p className="font-semibold">
                {driverLocation.speed ? `${Math.round(driverLocation.speed)} km/h` : 'N/A'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Map */}
      <Card className="overflow-hidden">
        <div ref={mapContainer} className="w-full h-[400px]" />
      </Card>

      {/* Last Updated */}
      <div className="text-center">
        <Badge variant="secondary" className="text-xs">
          Last updated: {new Date(driverLocation.updated_at).toLocaleTimeString()}
        </Badge>
      </div>
    </div>
  );
}
