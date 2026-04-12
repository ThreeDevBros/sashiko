import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/components/ThemeProvider';
import { useAppLifecycle } from '@/hooks/useAppLifecycle';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck, Navigation, WifiOff, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { getMapStyle, createMarkerIcon, triggerMapResize } from '@/lib/mapStyles';
import { loadGoogleMaps } from '@/lib/googleMaps';

interface OrderTrackingMapProps {
  orderId: string;
  orderType: 'delivery' | 'pickup' | 'dine_in';
  status: string;
  deliveryAddress?: {
    latitude?: number;
    longitude?: number;
    address_line1: string;
    city: string;
  } | null;
  restaurantLocation?: {
    latitude?: number;
    longitude?: number;
    name: string;
    address: string;
  } | null;
  guestDeliveryAddress?: string | null;
  guestDeliveryLat?: number | null;
  guestDeliveryLng?: number | null;
  isGuest?: boolean;
  guestDriverLocation?: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    updated_at: string;
  } | null;
}

interface DriverLocation {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  updated_at: string;
}

export function OrderTrackingMap({ 
  orderId, 
  orderType, 
  status,
  deliveryAddress, 
  restaurantLocation,
  guestDeliveryAddress,
  guestDeliveryLat,
  guestDeliveryLng,
  isGuest = false,
  guestDriverLocation,
}: OrderTrackingMapProps) {
  const { theme } = useTheme();
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<string>('');
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [connectionLost, setConnectionLost] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const deliveryMarkerRef = useRef<google.maps.Marker | null>(null);
  const restaurantMarkerRef = useRef<google.maps.Marker | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const connectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only show customer pin for delivery orders — unify sources for both guest and signed-in
  const rawCustomerLat = orderType === 'delivery' ? (deliveryAddress?.latitude ?? guestDeliveryLat ?? null) : null;
  const rawCustomerLng = orderType === 'delivery' ? (deliveryAddress?.longitude ?? guestDeliveryLng ?? null) : null;
  const customerLat = rawCustomerLat != null ? Number(rawCustomerLat) : null;
  const customerLng = rawCustomerLng != null ? Number(rawCustomerLng) : null;
  const driverTrackingActive = orderType === 'delivery' && ['ready', 'out_for_delivery'].includes(status);

  const restLat = restaurantLocation?.latitude ? Number(restaurantLocation.latitude) : null;
  const restLng = restaurantLocation?.longitude ? Number(restaurantLocation.longitude) : null;
  const hasRestaurantCoords = restLat != null && restLng != null && !isNaN(restLat) && !isNaN(restLng);

  // Main map initialization — re-runs whenever restaurant coords become available
  useEffect(() => {
    // Don't init if no coordinates or already initialized
    if (!hasRestaurantCoords) return;
    if (mapRef.current) return; // Already created

    let cancelled = false;

    const initMap = async () => {
      try {
        setMapState('loading');
        await loadGoogleMaps();
        if (cancelled) return;

        // Verify google.maps is actually available
        if (typeof google === 'undefined' || !google.maps) {
          throw new Error('Google Maps API not available after loading');
        }

        const el = containerRef.current;
        if (!el) {
          console.warn('Map container ref not available');
          if (!cancelled) setMapState('error');
          return;
        }
        
        // Wait for container to have layout dimensions
        // Use a polling approach that works across all browsers/webviews
        for (let i = 0; i < 60; i++) {
          if (cancelled) return;
          if (el.offsetWidth > 0 && el.offsetHeight > 0) break;
          await new Promise(r => setTimeout(r, 100));
        }

        // If still no dimensions, force them
        if (el.offsetWidth === 0 || el.offsetHeight === 0) {
          el.style.width = '100%';
          el.style.height = '300px';
          el.style.minHeight = '300px';
          // Wait for layout to apply
          await new Promise(r => setTimeout(r, 200));
        }

        if (cancelled) return;

        const isDark = theme !== 'light';
        const restPos = { lat: restLat!, lng: restLng! };

        const mapInstance = new google.maps.Map(el, {
          center: restPos,
          zoom: 14,
          disableDefaultUI: true,
          gestureHandling: orderType === 'delivery' ? 'greedy' : 'none',
          draggable: orderType === 'delivery',
          scrollwheel: orderType === 'delivery',
          disableDoubleClickZoom: orderType !== 'delivery',
          styles: getMapStyle(isDark),
          backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
        });

        mapRef.current = mapInstance;

        // Force resize after creation — critical for cross-browser/webview rendering
        triggerMapResize(mapInstance);

        // Also listen for idle event to confirm map is truly ready
        google.maps.event.addListenerOnce(mapInstance, 'idle', () => {
          triggerMapResize(mapInstance);
        });

        const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
        const strokeColor = primary ? `hsl(${primary})` : '#3b82f6';

        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          map: mapInstance,
          suppressMarkers: true,
          polylineOptions: { strokeColor, strokeWeight: 4, strokeOpacity: 0.8 },
        });

        // Restaurant marker
        restaurantMarkerRef.current = new google.maps.Marker({
          position: restPos,
          map: mapInstance,
          icon: createMarkerIcon('restaurant'),
          title: restaurantLocation?.name || 'Restaurant',
        });

        // Customer delivery marker
        if (customerLat != null && customerLng != null) {
          deliveryMarkerRef.current = new google.maps.Marker({
            position: { lat: customerLat, lng: customerLng },
            map: mapInstance,
            icon: createMarkerIcon('person'),
            title: 'Delivery Address',
          });

          const bounds = new google.maps.LatLngBounds();
          bounds.extend(restPos);
          bounds.extend({ lat: customerLat, lng: customerLng });
          mapInstance.fitBounds(bounds, 60);
        }

        if (!cancelled) setMapState('ready');
      } catch (err) {
        console.error('OrderTrackingMap init error:', err);
        if (!cancelled) setMapState('error');
      }
    };

    initMap();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRestaurantCoords, restLat, restLng, retryCount]);

  // Theme updates
  useEffect(() => {
    if (mapRef.current && theme) {
      mapRef.current.setOptions({ styles: getMapStyle(theme !== 'light') });
    }
  }, [theme]);

  // Update customer marker if address changes after map init (or map becomes ready after coords)
  useEffect(() => {
    if (mapState !== 'ready' || !mapRef.current || customerLat == null || customerLng == null) return;

    if (deliveryMarkerRef.current) {
      deliveryMarkerRef.current.setPosition({ lat: customerLat, lng: customerLng });
    } else {
      deliveryMarkerRef.current = new google.maps.Marker({
        position: { lat: customerLat, lng: customerLng },
        map: mapRef.current,
        icon: createMarkerIcon('person'),
        title: 'Delivery Address',
      });

      // Also fit bounds when marker is added late
      if (restLat != null && restLng != null) {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend({ lat: restLat, lng: restLng });
        bounds.extend({ lat: customerLat, lng: customerLng });
        mapRef.current.fitBounds(bounds, 60);
      }
    }
  }, [customerLat, customerLng, mapState, restLat, restLng]);

  // For guests, use the guestDriverLocation prop instead of realtime subscription
  useEffect(() => {
    if (!isGuest || !guestDriverLocation) return;
    setDriverLocation(guestDriverLocation);
    setConnectionLost(false);
    if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
    connectionTimerRef.current = setTimeout(() => setConnectionLost(true), 30000);
  }, [isGuest, guestDriverLocation]);

  // Resume counter for unique channel names after backgrounding
  const [mapResumeCounter, setMapResumeCounter] = useState(0);
  useAppLifecycle(() => { setMapResumeCounter(c => c + 1); });

  // Subscribe to real-time driver location (authenticated users only)
  useEffect(() => {
    if (orderType !== 'delivery' || !driverTrackingActive || isGuest) return;

    const channel = supabase
      .channel(`driver-location-${orderId}-${mapResumeCounter}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations', filter: `order_id=eq.${orderId}` },
        (payload) => {
          if (payload.new) {
            const n = payload.new as any;
            const now = Date.now();
            if (now - lastUpdateTimeRef.current < 1000) return;
            lastUpdateTimeRef.current = now;

            setDriverLocation({
              latitude: parseFloat(n.latitude),
              longitude: parseFloat(n.longitude),
              heading: n.heading ? parseFloat(n.heading) : undefined,
              speed: n.speed ? parseFloat(n.speed) : undefined,
              updated_at: n.updated_at,
            });
            setConnectionLost(false);
            if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
            connectionTimerRef.current = setTimeout(() => setConnectionLost(true), 30000);
          }
        }
      )
      .subscribe();

    // Load initial driver location
    (async () => {
      try {
        const { data } = await supabase
          .from('driver_locations')
          .select('*')
          .eq('order_id', orderId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          setDriverLocation({
            latitude: parseFloat(data.latitude.toString()),
            longitude: parseFloat(data.longitude.toString()),
            heading: data.heading ? parseFloat(data.heading.toString()) : undefined,
            speed: data.speed ? parseFloat(data.speed.toString()) : undefined,
            updated_at: data.updated_at,
          });
        }
      } catch (err) {
        console.error('Error loading driver location:', err);
      }
    })();

    connectionTimerRef.current = setTimeout(() => {
      // Initial watchdog
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
    };
  }, [orderId, orderType, driverTrackingActive, mapResumeCounter]);

  // Smooth marker animation
  const animateMarkerTo = useCallback((marker: google.maps.Marker, newPos: google.maps.LatLngLiteral, duration = 800) => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    const startPos = marker.getPosition();
    if (!startPos) { marker.setPosition(newPos); return; }
    
    const startLat = startPos.lat();
    const startLng = startPos.lng();
    const deltaLat = newPos.lat - startLat;
    const deltaLng = newPos.lng - startLng;
    const startTime = performance.now();

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      
      marker.setPosition({
        lat: startLat + deltaLat * eased,
        lng: startLng + deltaLng * eased,
      });

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
      }
    };

    animationFrameRef.current = requestAnimationFrame(step);
  }, []);

  // Update driver marker
  useEffect(() => {
    if (mapState !== 'ready' || !mapRef.current || !driverLocation || !driverTrackingActive) return;

    const pos = { lat: driverLocation.latitude, lng: driverLocation.longitude };

    if (driverMarkerRef.current) {
      animateMarkerTo(driverMarkerRef.current, pos);
    } else {
      driverMarkerRef.current = new google.maps.Marker({
        position: pos,
        map: mapRef.current,
        icon: createMarkerIcon('driver'),
        title: 'Driver',
        zIndex: 999,
      });
    }

    // Fit bounds to include all markers
    const bounds = new google.maps.LatLngBounds();
    if (restLat != null && restLng != null) {
      bounds.extend({ lat: restLat, lng: restLng });
    }
    if (customerLat != null && customerLng != null) {
      bounds.extend({ lat: customerLat, lng: customerLng });
    }
    bounds.extend(pos);
    mapRef.current.fitBounds(bounds, 60);

    // Draw route
    if (customerLat != null && customerLng != null && directionsRendererRef.current) {
      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        {
          origin: pos,
          destination: { lat: customerLat, lng: customerLng },
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, routeStatus) => {
          if (routeStatus === 'OK' && result) {
            directionsRendererRef.current?.setDirections(result);
            const route = result.routes[0];
            if (route?.legs[0]) {
              setEstimatedTime(route.legs[0].duration?.text || '');
            }
          }
        }
      );
    }
  }, [driverLocation, driverTrackingActive, animateMarkerTo, restLat, restLng, customerLat, customerLng, mapState]);

  // Remove driver marker when delivered
  useEffect(() => {
    if (status === 'delivered' && driverMarkerRef.current) {
      driverMarkerRef.current.setMap(null);
      driverMarkerRef.current = null;
    }
  }, [status]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const handleRetry = () => {
    // Reset map state and refs so the init effect can run again
    mapRef.current = null;
    restaurantMarkerRef.current = null;
    deliveryMarkerRef.current = null;
    driverMarkerRef.current = null;
    directionsRendererRef.current = null;
    setMapState('loading');
    setRetryCount(c => c + 1); // triggers init effect re-run
  };

  // If we have no restaurant coordinates yet, show a waiting state (not error)
  if (!hasRestaurantCoords) {
    return (
      <Card className="overflow-hidden">
        <div className="w-full h-[300px] flex items-center justify-center bg-muted/30">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  const driverHasLocation = driverTrackingActive && driverLocation;

  return (
    <div className="space-y-3">
      {/* Driver Status Bar */}
      {driverHasLocation && (
        <div className="flex flex-wrap gap-3">
          <Badge variant="secondary" className="flex items-center gap-2 py-2 px-3">
            <Truck className="h-4 w-4 text-green-500" />
            <span>{status === 'out_for_delivery' ? 'Driver on the way' : 'Driver assigned'}</span>
          </Badge>
          
          {estimatedTime && status === 'out_for_delivery' && (
            <Badge variant="secondary" className="flex items-center gap-2 py-2 px-3">
              <Navigation className="h-4 w-4 text-primary" />
              <span>ETA: {estimatedTime}</span>
            </Badge>
          )}
          
          {driverLocation.speed && driverLocation.speed > 0 && (
            <Badge variant="secondary" className="flex items-center gap-2 py-2 px-3">
              <span>{Math.round(driverLocation.speed)} km/h</span>
            </Badge>
          )}
        </div>
      )}

      {/* Reconnecting indicator */}
      {connectionLost && driverTrackingActive && driverLocation && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <WifiOff className="h-3.5 w-3.5" />
          <span>Reconnecting…</span>
        </div>
      )}

      {/* Map */}
      <Card className="overflow-hidden">
        {mapState === 'error' ? (
          <div className="w-full h-[300px] flex flex-col items-center justify-center bg-muted/30 gap-3 px-4">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              Map could not be loaded. Your order is still being tracked.
            </p>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : (
          <div className="relative">
            <div 
              ref={containerRef} 
              className="w-full" 
              style={{ height: '300px', minHeight: '300px', minWidth: '100%' }} 
            />
            {mapState === 'loading' && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#FF7A00] border-2 border-white shadow" />
          <span className="text-muted-foreground">Restaurant</span>
        </div>
        {orderType === 'delivery' && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[#4285F4] border-2 border-white shadow" />
            <span className="text-muted-foreground">You</span>
          </div>
        )}
        {orderType === 'delivery' && (
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full border-2 border-white shadow ${
              driverHasLocation ? 'bg-[#22c55e]' : 'bg-muted-foreground/30'
            }`} />
            <span className={driverHasLocation ? 'text-muted-foreground' : 'text-muted-foreground/50'}>
              Driver
            </span>
            {driverTrackingActive && !driverLocation && (
              <span className="text-[11px] text-muted-foreground/50 italic">Waiting for driver</span>
            )}
          </div>
        )}
      </div>

      {/* Last Updated */}
      {driverLocation && driverTrackingActive && !connectionLost && (
        <p className="text-center text-xs text-muted-foreground">
          Driver location updated: {new Date(driverLocation.updated_at).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
