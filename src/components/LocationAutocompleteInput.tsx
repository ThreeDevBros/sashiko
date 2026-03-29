import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, MapPin, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { loadGoogleMaps } from '@/lib/googleMaps';

export interface PlaceResult {
  address: string;
  latitude: number;
  longitude: number;
  city?: string;
  postalCode?: string;
  addressLine1?: string;
  placeId?: string;
}

interface Prediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
  description: string;
  placePrediction: any;
}

interface LocationAutocompleteInputProps {
  onSelect: (place: PlaceResult) => void;
  placeholder?: string;
  country?: string;
  className?: string;
  autoFocus?: boolean;
  /** Hide the confirm button (e.g. when parent handles confirmation separately) */
  hideConfirm?: boolean;
  /** Show "Can't find your address? Pin it on the map" button */
  onPinMapClick?: () => void;
}

/**
 * Custom Google Places Autocomplete using Places API (New) data endpoint.
 * Clicking a suggestion immediately applies it. A confirm button is shown as fallback.
 */
export function LocationAutocompleteInput({
  onSelect,
  placeholder = 'Search Address',
  country = 'cy',
  className = '',
  autoFocus = false,
  hideConfirm = false,
  onPinMapClick,
}: LocationAutocompleteInputProps) {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [selecting, setSelecting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const latestRequestIdRef = useRef(0);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    let isMounted = true;

    loadGoogleMaps(['places'])
      .then(() => {
        const autocompleteSuggestionApi = (google?.maps?.places as any)?.AutocompleteSuggestion;

        if (!autocompleteSuggestionApi?.fetchAutocompleteSuggestions) {
          console.error('[LocationAutocomplete] AutocompleteSuggestion API not available');
          if (!isMounted) return;
          setError(true);
          setLoading(false);
          return;
        }

        if (!isMounted) return;
        setLoading(false);
        if (autoFocus) setTimeout(() => inputRef.current?.focus(), 100);
      })
      .catch((err) => {
        console.error('[LocationAutocomplete] Load failed:', err);
        if (!isMounted) return;
        setError(true);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [autoFocus]);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 2) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    const autocompleteSuggestionApi = (google?.maps?.places as any)?.AutocompleteSuggestion;
    if (!autocompleteSuggestionApi?.fetchAutocompleteSuggestions) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    const requestId = ++latestRequestIdRef.current;

    try {
      const { suggestions = [] } = await autocompleteSuggestionApi.fetchAutocompleteSuggestions({
        input,
        includedRegionCodes: [country.toLowerCase()],
      });

      if (requestId !== latestRequestIdRef.current) return;

      const mapped = suggestions
        .map((suggestion: any) => {
          const placePrediction = suggestion?.placePrediction;
          if (!placePrediction?.placeId) return null;

          const description = placePrediction?.text?.text || '';
          const [mainText = '', ...rest] = description.split(',');

          return {
            placeId: placePrediction.placeId,
            mainText: mainText.trim() || description,
            secondaryText: rest.join(',').trim(),
            description,
            placePrediction,
          } as Prediction;
        })
        .filter(Boolean) as Prediction[];

      setPredictions(mapped);
      setShowDropdown(mapped.length > 0);
    } catch (err) {
      console.error('[LocationAutocomplete] Prediction fetch failed:', err);
      if (requestId !== latestRequestIdRef.current) return;
      setPredictions([]);
      setShowDropdown(false);
    }
  }, [country]);

  const handleChange = (val: string) => {
    setQuery(val);
    // Clear selected place when user types again
    setSelectedPlace(null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(val), 300);
  };

  /** Shared apply function — used by both suggestion click and confirm button */
  const applyLocation = useCallback((place: PlaceResult) => {
    setSelectedPlace(place);
    setQuery(place.address);
    setShowDropdown(false);
    setPredictions([]);
    onSelectRef.current(place);
  }, []);

  const handleSelect = async (p: Prediction) => {
    // Immediately close dropdown and show selecting state
    setShowDropdown(false);
    setPredictions([]);
    setQuery(p.description);
    setSelecting(true);

    try {
      const place = p.placePrediction?.toPlace?.();
      if (!place) {
        console.warn('[LocationAutocomplete] toPlace() returned null, using fallback');
        // Fallback: use the description as address with no coordinates
        // This shouldn't normally happen but prevents silent failure
        setSelecting(false);
        return;
      }

      await place.fetchFields({ fields: ['formattedAddress', 'location', 'addressComponents'] });

      const location = place.location;
      if (!location) {
        console.warn('[LocationAutocomplete] No location from fetchFields');
        setSelecting(false);
        return;
      }

      let city = '';
      let postalCode = '';
      let streetNumber = '';
      let route = '';

      for (const c of place.addressComponents || []) {
        const t = Array.isArray(c.types) ? c.types : [];
        const value = (c.longText ?? (c as any).long_name ?? '') as string;

        if (!value) continue;
        if (t.includes('locality') || t.includes('administrative_area_level_1')) city = value;
        if (t.includes('postal_code')) postalCode = value;
        if (t.includes('street_number')) streetNumber = value;
        if (t.includes('route')) route = value;
      }

      const result: PlaceResult = {
        address: place.formattedAddress || p.description,
        latitude: location.lat(),
        longitude: location.lng(),
        city,
        postalCode,
        addressLine1: [streetNumber, route].filter(Boolean).join(' ') || '',
        placeId: p.placeId,
      };

      // Immediately apply the location
      applyLocation(result);
    } catch (err) {
      console.error('[LocationAutocomplete] Failed to select prediction:', err);
    } finally {
      setSelecting(false);
    }
  };

  const handleConfirm = () => {
    if (selectedPlace) {
      applyLocation(selectedPlace);
    }
  };

  if (error) {
    return <div className={`text-sm text-muted-foreground p-3 border border-border rounded-lg ${className}`}>Address search unavailable.</div>;
  }

  return (
    <div className={`relative ${className}`} data-vaul-no-drag>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-2 p-3 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : (
          <Input
            ref={inputRef}
            value={query}
            onChange={e => handleChange(e.target.value)}
            onFocus={() => predictions.length > 0 && setShowDropdown(true)}
            placeholder={placeholder}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-11 text-sm"
            autoComplete="off"
            data-vaul-no-drag
          />
        )}
      </div>

      {/* Dropdown — inline with max-height, never covers the confirm button */}
      {showDropdown && predictions.length > 0 && (
        <div className="mt-1 rounded-xl border border-border bg-card shadow-lg max-h-48 overflow-y-auto" data-vaul-no-drag>
          {predictions.map(p => (
            <button
              key={p.placeId}
              type="button"
              onClick={() => handleSelect(p)}
              className="w-full flex items-start gap-3 px-3 py-3 text-left hover:bg-muted/50 active:bg-muted transition-colors touch-manipulation"
              data-vaul-no-drag
            >
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.mainText}</p>
                <p className="text-xs text-muted-foreground truncate">{p.secondaryText}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Confirm button — always visible below dropdown, never covered */}
      {!hideConfirm && (
        <div className="mt-2" data-vaul-no-drag>
          {selecting ? (
            <Button type="button" disabled className="w-full gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Applying…
            </Button>
          ) : selectedPlace ? (
            <Button type="button" onClick={handleConfirm} className="w-full gap-2">
              <Check className="h-4 w-4" />
              Confirm Location
            </Button>
          ) : (
            <Button type="button" disabled variant="outline" className="w-full text-muted-foreground">
              Select a location from the suggestions
            </Button>
          )}
        </div>
      )}

      {/* Pin on map fallback button */}
      {onPinMapClick && (
        <div className="mt-2" data-vaul-no-drag>
          <Button
            type="button"
            variant="outline"
            onClick={onPinMapClick}
            className="w-full gap-2 border-[hsl(45,90%,50%)]/40 text-[hsl(45,90%,50%)] hover:bg-[hsl(45,90%,50%)]/10 hover:text-[hsl(45,90%,55%)]"
          >
            <MapPin className="h-4 w-4" />
            Can't find your address? Pin it on the map
          </Button>
        </div>
      )}
    </div>
  );
}
