import { useCallback, useState } from 'react';
import { isIOSNative, openInGoogleMaps, tryNativeMapsShare } from '@/lib/openDirections';
import { DirectionsChooserSheet } from '@/components/DirectionsChooserSheet';

interface Target {
  lat: number | string;
  lng: number | string;
  label?: string;
}

/**
 * useDirections — single entry point used by every "Need directions" button.
 *
 * Behavior:
 *  - Web/Android: opens Google Maps directly (unchanged).
 *  - iOS native: tries the iOS share sheet (system maps picker). If unavailable,
 *    falls back to an in-app bottom sheet with Apple Maps / Google Maps options.
 */
export function useDirections() {
  const [target, setTarget] = useState<Target | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);

  const open = useCallback(async (t: Target) => {
    if (!isIOSNative()) {
      openInGoogleMaps(t.lat, t.lng);
      return;
    }
    const shown = await tryNativeMapsShare(t.lat, t.lng, t.label);
    if (shown) return;
    setTarget(t);
    setChooserOpen(true);
  }, []);

  const sheet = (
    <DirectionsChooserSheet
      open={chooserOpen}
      onOpenChange={setChooserOpen}
      lat={target?.lat}
      lng={target?.lng}
      label={target?.label}
    />
  );

  return { open, sheet };
}
