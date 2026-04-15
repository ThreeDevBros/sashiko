import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Navigation, Loader2, ArrowLeft, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { toast } from 'sonner';
import { getDetailedMapStyle } from '@/lib/mapStyles';
import type { PlaceResult } from '@/components/LocationAutocompleteInput';

interface PinDropMapOverlayProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (place: PlaceResult) => void;
  initialLat?: number | null;
  initialLng?: number | null;
}

const DEFAULT_CENTER = { lat: 35.1264, lng: 33.4299 }; // Cyprus

export function PinDropMapOverlay({ open, onClose, onConfirm, initialLat, initialLng }: PinDropMapOverlayProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const initDone = useRef(false);

  const [pinned, setPinned] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [isSatellite, setIsSatellite] = useState(false);

  // ── helpers (stable refs, no re-renders) ──────────────────────────
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ location: { lat, lng } });
      if (result.results?.length) {
        const place = result.results[0];
        setAddress(place.formatted_address || 'Pinned location');
        let _city = '', _postal = '', _streetNum = '', _route = '';
        place.address_components?.forEach(c => {
          if (c.types.includes('locality') || c.types.includes('administrative_area_level_1')) _city = c.long_name;
          if (c.types.includes('postal_code')) _postal = c.long_name;
          if (c.types.includes('street_number')) _streetNum = c.long_name;
          if (c.types.includes('route')) _route = c.long_name;
        });
        setCity(_city);
        setPostalCode(_postal);
        setAddressLine1(_streetNum ? `${_streetNum} ${_route}` : _route || place.formatted_address?.split(',')[0] || '');
      } else {
        setAddress('Pinned location');
        setCity('');
        setPostalCode('');
        setAddressLine1('');
      }
    } catch {
      setAddress('Pinned location');
    }
  }, []);

  const placePin = useCallback((lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;

    if (markerRef.current) markerRef.current.setMap(null);

    markerRef.current = new google.maps.Marker({
      position: { lat, lng },
      map,
      draggable: true,
    });

    markerRef.current.addListener('dragend', () => {
      const pos = markerRef.current?.getPosition();
      if (pos) {
        setPinned({ lat: pos.lat(), lng: pos.lng() });
        reverseGeocode(pos.lat(), pos.lng());
      }
    });

    map.panTo({ lat, lng });
    setPinned({ lat, lng });
    reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  // ── Force-clear body styles left by Drawer (vaul) ─────────────────
  useEffect(() => {
    if (!open) return;

    // Vaul's Drawer sets overflow:hidden, pointer-events, and transforms
    // on document.body during close animation. Force-clear them so the
    // map receives touch/pointer events reliably.
    const clearBodyStyles = () => {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
      document.body.style.userSelect = '';
      // Remove vaul wrapper transforms if present
      const wrapper = document.querySelector('[data-vaul-drawer-wrapper]') as HTMLElement | null;
      if (wrapper) {
        wrapper.style.transform = '';
        wrapper.style.transition = '';
      }
    };

    // Run immediately and again after Drawer's close animation completes
    clearBodyStyles();
    const t1 = setTimeout(clearBodyStyles, 100);
    const t2 = setTimeout(clearBodyStyles, 300);
    const t3 = setTimeout(clearBodyStyles, 500);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [open]);

  // ── Reset when overlay closes ─────────────────────────────────────
  useEffect(() => {
    if (!open) {
      if (markerRef.current) { markerRef.current.setMap(null); markerRef.current = null; }
      if (mapRef.current) { mapRef.current = null; }
      initDone.current = false;
      setPinned(null);
      setAddress('');
      setCity('');
      setPostalCode('');
      setAddressLine1('');
      setMapReady(false);
    }
  }, [open]);

  // ── Initialize map ────────────────────────────────────────────────
  useEffect(() => {
    if (!open || initDone.current) return;

    let cancelled = false;

    const init = async () => {
      try {
        await loadGoogleMaps(['maps']);
      } catch (e) {
        console.error('Failed to load Google Maps:', e);
        return;
      }

      if (cancelled) return;

      // Wait until container is in DOM with real dimensions
      const waitForContainer = (): Promise<HTMLDivElement> =>
        new Promise((resolve) => {
          const check = () => {
            const el = mapContainer.current;
            if (el && el.offsetHeight > 0 && el.offsetWidth > 0) {
              resolve(el);
            } else {
              requestAnimationFrame(check);
            }
          };
          check();
        });

      const container = await waitForContainer();
      if (cancelled) return;

      const center = initialLat && initialLng
        ? { lat: initialLat, lng: initialLng }
        : DEFAULT_CENTER;

      const isDark = !document.documentElement.classList.contains('light');

      const map = new google.maps.Map(container, {
        center,
        zoom: initialLat && initialLng ? 16 : 10,
        mapTypeId: 'roadmap',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
        keyboardShortcuts: false,
        disableDefaultUI: false,
        styles: getDetailedMapStyle(isDark),
      });

      mapRef.current = map;
      initDone.current = true;

      // Multiple resize triggers to guarantee tiles render
      const triggerResize = () => {
        if (!mapRef.current) return;
        google.maps.event.trigger(mapRef.current, 'resize');
        mapRef.current.setCenter(center);
      };
      setTimeout(triggerResize, 100);
      setTimeout(triggerResize, 300);
      setTimeout(triggerResize, 600);

      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) placePin(e.latLng.lat(), e.latLng.lng());
      });

      setMapReady(true);

      if (initialLat && initialLng) {
        placePin(initialLat, initialLng);
      }
    };

    // Delay init to let Drawer fully unmount and body styles clear
    const timer = setTimeout(init, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, initialLat, initialLng, placePin]);

  // ── GPS — only on explicit tap ────────────────────────────────────
  const handleGPS = async () => {
    if (!isGeolocationAvailable()) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setGettingLocation(true);
    try {
      const pos = await getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
      placePin(pos.coords.latitude, pos.coords.longitude);
      mapRef.current?.setZoom(16);
    } catch {
      toast('Location unavailable — pan the map and tap to pin', { duration: 3000 });
    } finally {
      setGettingLocation(false);
    }
  };

  const toggleSatellite = () => {
    const map = mapRef.current;
    if (!map) return;
    const newSat = !isSatellite;
    setIsSatellite(newSat);
    if (newSat) {
      map.setMapTypeId('hybrid');
      map.setOptions({ styles: [] });
    } else {
      const isDark = !document.documentElement.classList.contains('light');
      map.setMapTypeId('roadmap');
      map.setOptions({ styles: getDetailedMapStyle(isDark) });
    }
  };

  const handleConfirm = () => {
    if (!pinned) return;
    onConfirm({
      address: address || 'Pinned location',
      latitude: pinned.lat,
      longitude: pinned.lng,
      city: city || undefined,
      postalCode: postalCode || undefined,
      addressLine1: addressLine1 || undefined,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-background"
      style={{
        display: 'flex',
        flexDirection: 'column',
        touchAction: 'auto',
        pointerEvents: 'auto',
        overflow: 'hidden',
      }}
    >
      {/* Back button — top left */}
      <div className="absolute top-4 left-4 z-[10001] group">
        <button
          onClick={onClose}
          className="relative h-[50px] w-[50px] rounded-full flex items-center justify-center bg-primary text-primary-foreground shadow-[0_4px_20px_rgba(249,115,22,0.35)] border border-primary/30 transition-all duration-200 hover:shadow-[0_4px_24px_rgba(249,115,22,0.5)] hover:scale-105 active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        <span className="absolute left-[58px] top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md text-xs font-medium text-white bg-[rgba(20,20,20,0.9)] border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
          Back
        </span>
      </div>

      {/* GPS & Satellite buttons — top right */}
      <div className="absolute top-4 right-4 z-[10001] flex flex-col gap-3">
        {/* My Location */}
        <div className="group flex items-center justify-end">
          <span className="mr-2.5 px-2.5 py-1 rounded-md text-xs font-medium text-white bg-[rgba(20,20,20,0.9)] border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            My Location
          </span>
          <button
            onClick={handleGPS}
            disabled={gettingLocation}
            className={`relative h-[50px] w-[50px] rounded-full flex items-center justify-center border transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-60 ${
              gettingLocation
                ? 'bg-primary text-primary-foreground border-primary/30 shadow-[0_4px_20px_rgba(249,115,22,0.35)] animate-pulse'
                : 'bg-[rgba(20,20,20,0.85)] text-white border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.4)] hover:shadow-[0_4px_24px_rgba(249,115,22,0.3)] hover:border-primary/40'
            }`}
          >
            {gettingLocation ? (
              <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} />
            ) : (
              <Navigation className="h-5 w-5" strokeWidth={2} />
            )}
          </button>
        </div>

        {/* Satellite / Map Style */}
        <div className="group flex items-center justify-end">
          <span className="mr-2.5 px-2.5 py-1 rounded-md text-xs font-medium text-white bg-[rgba(20,20,20,0.9)] border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            {isSatellite ? 'Map View' : 'Satellite'}
          </span>
          <button
            onClick={toggleSatellite}
            className={`relative h-[50px] w-[50px] rounded-full flex items-center justify-center border transition-all duration-200 hover:scale-105 active:scale-95 ${
              isSatellite
                ? 'bg-primary text-primary-foreground border-primary/30 shadow-[0_4px_20px_rgba(249,115,22,0.35)]'
                : 'bg-[rgba(20,20,20,0.85)] text-white border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.4)] hover:shadow-[0_4px_24px_rgba(249,115,22,0.3)] hover:border-primary/40'
            }`}
          >
            <Layers className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Map container — touch-action:auto ensures browser passes gestures to Google Maps */}
      <div
        ref={mapContainer}
        style={{
          flex: '1 1 0%',
          width: '100%',
          minHeight: '300px',
          position: 'relative',
          zIndex: 1,
          touchAction: 'auto',
          pointerEvents: 'auto',
        }}
      />

      {/* Loading indicator while map boots */}
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center z-[10000] pointer-events-none">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Bottom panel */}
      <div className="bg-background border-t border-border p-4 space-y-3" style={{ position: 'relative', zIndex: 10000 }}>
        {pinned ? (
          <>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">
                  {addressLine1 || 'Pinned location'}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {city ? `${city}${postalCode ? `, ${postalCode}` : ''}` : 'Drag the pin to adjust'}
                </p>
              </div>
            </div>
            <Button onClick={handleConfirm} className="w-full" size="lg">
              Confirm Location
            </Button>
          </>
        ) : (
          <p className="text-center text-muted-foreground py-2">
            Tap on the map to pin your location
          </p>
        )}
      </div>
    </div>
  );
}
