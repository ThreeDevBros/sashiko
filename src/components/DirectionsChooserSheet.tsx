import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MapPin, ChevronRight } from 'lucide-react';
import googleMapsIcon from '@/assets/google-maps-icon.png';
import { openInAppleMaps, openInGoogleMaps } from '@/lib/openDirections';

interface DirectionsChooserSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lat: number | string | null | undefined;
  lng: number | string | null | undefined;
  label?: string;
}

export function DirectionsChooserSheet({ open, onOpenChange, lat, lng, label }: DirectionsChooserSheetProps) {
  const handlePick = (provider: 'apple' | 'google') => {
    if (lat == null || lng == null) return;
    if (provider === 'apple') openInAppleMaps(lat, lng, label);
    else openInGoogleMaps(lat, lng);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-5 pb-8">
        <SheetHeader className="pb-4 text-left">
          <SheetTitle className="text-lg font-bold text-foreground">Open in Maps</SheetTitle>
          <p className="text-sm text-muted-foreground">Choose which app to use for directions.</p>
        </SheetHeader>

        <div className="space-y-2">
          <button
            onClick={() => handlePick('apple')}
            className="flex items-center gap-3 w-full px-4 py-3 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:bg-accent/10 transition-colors"
          >
            <span className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MapPin className="h-5 w-5 text-primary" />
            </span>
            <span className="flex-1 text-left">Apple Maps</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          <button
            onClick={() => handlePick('google')}
            className="flex items-center gap-3 w-full px-4 py-3 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:bg-accent/10 transition-colors"
          >
            <img src={googleMapsIcon} alt="" className="h-9 w-9 rounded-lg object-contain flex-shrink-0" />
            <span className="flex-1 text-left">Google Maps</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
