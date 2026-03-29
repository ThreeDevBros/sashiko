import { useEffect, useState } from 'react';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { StaffOrderMap } from './StaffOrderMap';
import { Loader2 } from 'lucide-react';

interface GeocodedStaffMapProps {
  branchLat: number;
  branchLng: number;
  branchName: string;
  addressText: string;
}

export const GeocodedStaffMap = ({ branchLat, branchLng, branchName, addressText }: GeocodedStaffMapProps) => {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const geocode = async () => {
      try {
        await loadGoogleMaps(['maps']);
        if (cancelled) return;

        const geocoder = new google.maps.Geocoder();
        const result = await geocoder.geocode({ address: addressText });
        
        if (!cancelled && result.results?.[0]?.geometry?.location) {
          const loc = result.results[0].geometry.location;
          setCoords({ lat: loc.lat(), lng: loc.lng() });
        }
      } catch (err) {
        console.error('Geocoding failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    geocode();
    return () => { cancelled = true; };
  }, [addressText]);

  if (loading) {
    return (
      <div className="h-[180px] rounded-lg border bg-muted flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!coords) return null;

  return (
    <StaffOrderMap
      branchLat={branchLat}
      branchLng={branchLng}
      branchName={branchName}
      deliveryLat={coords.lat}
      deliveryLng={coords.lng}
      deliveryAddress={addressText}
    />
  );
};
