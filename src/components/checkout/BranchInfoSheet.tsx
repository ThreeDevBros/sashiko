import { useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MapPin, Clock, Phone, Star, ExternalLink, Navigation, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/components/ThemeProvider';
import { createMarkerIcon, getMapStyle, triggerMapResize, waitForContainerReady } from '@/lib/mapStyles';
import { loadGoogleMaps } from '@/lib/googleMaps';
import googleMapsIcon from '@/assets/google-maps-icon.png';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { Branch, BranchHours } from '@/types';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface BranchInfoSheetProps {
  branch: Branch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BranchInfoSheet({ branch, open, onOpenChange }: BranchInfoSheetProps) {
  const { theme } = useTheme();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);

  const { data: branchHours } = useQuery({
    queryKey: ['branch-hours-info', branch?.id],
    queryFn: async () => {
      if (!branch?.id) return [];
      const { data, error } = await supabase
        .from('branch_hours')
        .select('*')
        .eq('branch_id', branch.id)
        .order('day_of_week');
      if (error) throw error;
      return data as BranchHours[];
    },
    enabled: !!branch?.id && open,
  });

  // Determine if currently open based on per-day hours
  const getCurrentDayStatus = () => {
    if (!branchHours || branchHours.length === 0) {
      // Fallback to legacy opens_at/closes_at
      return null;
    }
    const now = new Date();
    const jsDay = now.getDay(); // 0=Sun
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // Convert to 0=Mon
    const dayHours = branchHours.find(h => h.day_of_week === dayOfWeek);
    if (!dayHours) return null;
    if (dayHours.is_closed) return { isOpen: false, label: 'Closed Today' };
    if (dayHours.is_24h) return { isOpen: true, label: 'Open 24 Hours' };
    return { isOpen: true, label: `${dayHours.open_time?.slice(0, 5)} – ${dayHours.close_time?.slice(0, 5)}` };
  };

  const dayStatus = getCurrentDayStatus();
  const isOpen = dayStatus ? dayStatus.isOpen : true;

  useEffect(() => {
    if (!open || !branch?.latitude || !branch?.longitude) return;

    let cancelled = false;
    let timer: number | undefined;

    const initMap = async () => {
      try {
        if (!mapContainer.current) return;
        await loadGoogleMaps(['maps']);
        if (cancelled || !mapContainer.current) return;

        // Force explicit dimensions so the map can render even if off-screen
        const el = mapContainer.current;
        if (el.offsetWidth === 0 || el.offsetHeight === 0) {
          el.style.minHeight = '192px';
          el.style.minWidth = '100%';
        }

        const ready = await waitForContainerReady(el, 5000);
        if (cancelled || !mapContainer.current) return;
        // Even if timed out, try anyway since we forced dimensions
        if (!ready) console.warn('BranchInfoSheet map container timed out, rendering anyway');
        if (cancelled || !mapContainer.current) return;

        const center = { lat: Number(branch.latitude), lng: Number(branch.longitude) };
        const styles = getMapStyle(theme !== 'light');

        const map = new google.maps.Map(mapContainer.current, {
          center,
          zoom: 13,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'none',
          draggable: false,
          scrollwheel: false,
          disableDoubleClickZoom: true,
          keyboardShortcuts: false,
          zoomControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles,
        });

        mapRef.current = map;

        google.maps.event.addListenerOnce(map, 'idle', () => {
          map.setOptions({ styles });
        });

        markerRef.current?.setMap(null);
        markerRef.current = new google.maps.Marker({
          position: center,
          map,
          icon: createMarkerIcon('restaurant'),
          title: branch.name,
        });

        circleRef.current?.setMap(null);
        circleRef.current = null;

        if (branch.delivery_radius_km) {
          circleRef.current = new google.maps.Circle({
            map,
            center,
            radius: Number(branch.delivery_radius_km) * 1000,
            fillColor: '#FF7A00',
            fillOpacity: 0.08,
            strokeColor: '#FF7A00',
            strokeOpacity: 0.4,
            strokeWeight: 2,
            clickable: false,
          });
          // Fit map to show entire delivery radius
          const bounds = circleRef.current.getBounds();
          if (bounds) {
            map.fitBounds(bounds, 20);
          }
        }

        triggerMapResize(map);
        window.setTimeout(() => {
          if (!cancelled && mapRef.current) {
            google.maps.event.trigger(mapRef.current, 'resize');
            if (circleRef.current?.getBounds()) {
              mapRef.current.fitBounds(circleRef.current.getBounds()!, 20);
            } else {
              mapRef.current.setCenter(center);
            }
          }
        }, 250);
      } catch (err) {
        console.error('Failed to init branch info map:', err);
      }
    };

    timer = window.setTimeout(initMap, 400);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      markerRef.current?.setMap(null);
      markerRef.current = null;
      circleRef.current?.setMap(null);
      circleRef.current = null;
      mapRef.current = null;
    };
  }, [open, branch?.id, branch?.name, branch?.latitude, branch?.longitude, branch?.delivery_radius_km, theme]);

  if (!branch) return null;

  const openDirections = () => {
    if (branch.latitude && branch.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${branch.latitude},${branch.longitude}`, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-5 pb-8">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-xl font-bold text-foreground">{branch.name}</SheetTitle>
          <Badge variant="outline" className={`w-fit text-xs ${isOpen ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
            {dayStatus ? (dayStatus.isOpen ? 'Open Now' : 'Closed') : 'Open Now'}
          </Badge>
        </SheetHeader>

        <div className="space-y-5">
          {branch.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{branch.description}</p>
          )}

          <div className="space-y-3">
            {/* Per-day hours */}
            {branchHours && branchHours.length > 0 ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground">Opening Hours</span>
                </div>
                {branchHours.map(h => (
                  <div key={h.day_of_week} className="flex items-center justify-between text-xs px-6">
                    <span className="font-medium w-10">{DAY_NAMES[h.day_of_week]}</span>
                    <span className="text-muted-foreground">
                      {h.is_closed ? 'Closed' : h.is_24h ? '24 Hours' : `${h.open_time?.slice(0, 5)} – ${h.close_time?.slice(0, 5)}`}
                    </span>
                    {!h.is_closed && h.delivery_enabled && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Truck className="w-3 h-3" />
                        {h.is_24h ? '24h' : `${(h.delivery_open_time || h.open_time)?.slice(0, 5)} – ${(h.delivery_close_time || h.close_time)?.slice(0, 5)}`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (branch.opens_at || branch.closes_at) ? (
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-foreground">{branch.opens_at} – {branch.closes_at}</span>
              </div>
            ) : null}

            <div className="flex items-start gap-3 text-sm">
              <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <span className="text-foreground">{branch.address}{branch.city ? `, ${branch.city}` : ''}</span>
            </div>

            {branch.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-primary flex-shrink-0" />
                <a href={`tel:${branch.phone}`} className="text-foreground underline underline-offset-2">{branch.phone}</a>
              </div>
            )}

            {branch.google_maps_rating != null && branch.google_maps_rating > 0 && (
              <div className="flex items-center gap-3 text-sm">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />
                <span className="text-foreground font-medium">{branch.google_maps_rating}</span>
                {branch.google_maps_review_count && (
                  <span className="text-muted-foreground">({branch.google_maps_review_count} reviews)</span>
                )}
              </div>
            )}

            {branch.delivery_radius_km && (
              <div className="flex items-center gap-3 text-sm">
                <Navigation className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-foreground">{branch.delivery_radius_km} km delivery radius</span>
              </div>
            )}
          </div>

          {branch.latitude && branch.longitude && (
            <button
              onClick={openDirections}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-card border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
            >
              <img src={googleMapsIcon} alt="Google Maps" className="h-9 w-9 rounded-md object-contain" />
              Need Directions? Open in Maps
              <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-60" />
            </button>
          )}

          {branch.latitude && branch.longitude && (
            <div className="rounded-xl overflow-hidden border border-border bg-muted/20" style={{ minHeight: '192px' }}>
              <div ref={mapContainer} className="w-full" style={{ height: '192px' }} />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
