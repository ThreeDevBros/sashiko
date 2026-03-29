import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { createMarkerIcon, waitForContainerReady, triggerMapResize } from '@/lib/mapStyles';

interface StaffOrderMapProps {
  branchLat: number;
  branchLng: number;
  branchName: string;
  deliveryLat: number;
  deliveryLng: number;
  deliveryAddress: string;
}

export const StaffOrderMap = ({ branchLat, branchLng, branchName, deliveryLat, deliveryLng, deliveryAddress }: StaffOrderMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await loadGoogleMaps(['maps']);
        if (cancelled) return;
        setReady(true);
      } catch (err) {
        console.error('StaffOrderMap: Failed to load Google Maps:', err);
        if (!cancelled) setError(true);
      }
    };

    init();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;

    let cancelled = false;

    const setup = async () => {
      await waitForContainerReady(mapRef.current!, 3000);
      if (cancelled) return;

      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: branchLat, lng: branchLng });
      bounds.extend({ lat: deliveryLat, lng: deliveryLng });

      if (!mapInstance.current) {
        mapInstance.current = new google.maps.Map(mapRef.current!, {
          center: bounds.getCenter(),
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
          draggable: true,
          scrollwheel: true,
          disableDoubleClickZoom: false,
          styles: [
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          ],
        });
        triggerMapResize(mapInstance.current);
      }

    const map = mapInstance.current;
    map.fitBounds(bounds, 50);

    // Branch marker – uses the shared checkout-style "restaurant" pin
    const branchMarker = new google.maps.Marker({
      map,
      position: { lat: branchLat, lng: branchLng },
      title: branchName,
      icon: createMarkerIcon('restaurant'),
    });

    // Delivery marker – uses the shared checkout-style "person" pin
    const deliveryMarkerObj = new google.maps.Marker({
      map,
      position: { lat: deliveryLat, lng: deliveryLng },
      title: deliveryAddress,
      icon: createMarkerIcon('person'),
    });

      return () => {
        branchMarker.setMap(null);
        deliveryMarkerObj.setMap(null);
      };
    };

    setup();
    return () => { cancelled = true; };
  }, [ready, branchLat, branchLng, branchName, deliveryLat, deliveryLng, deliveryAddress]);

  if (error) {
    return (
      <div className="h-[180px] rounded-lg border bg-muted flex items-center justify-center">
        <a
          href={`https://www.google.com/maps/dir/${branchLat},${branchLng}/${deliveryLat},${deliveryLng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
        >
          Open route in Google Maps
        </a>
      </div>
    );
  }

  return <div ref={mapRef} className="h-[180px] rounded-lg border overflow-hidden" />;
};
