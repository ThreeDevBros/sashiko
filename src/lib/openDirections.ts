import { Capacitor } from '@capacitor/core';

export const isIOSNative = (): boolean => {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  } catch {
    return false;
  }
};

export const googleMapsDirectionsUrl = (lat: number | string, lng: number | string): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export const appleMapsDirectionsUrl = (
  lat: number | string,
  lng: number | string,
  label?: string
): string => {
  const q = label ? `&q=${encodeURIComponent(label)}` : '';
  return `https://maps.apple.com/?daddr=${lat},${lng}${q}`;
};

export const openInGoogleMaps = (lat: number | string, lng: number | string) => {
  window.open(googleMapsDirectionsUrl(lat, lng), '_blank', 'noopener,noreferrer');
};

export const openInAppleMaps = (lat: number | string, lng: number | string, label?: string) => {
  // Apple Maps universal link — on iOS opens the native Maps app, on web opens maps.apple.com
  window.open(appleMapsDirectionsUrl(lat, lng, label), '_blank', 'noopener,noreferrer');
};

/**
 * Try to invoke iOS native share sheet (UIActivityViewController) which surfaces
 * "Open in Maps", "Open in Google Maps", etc. as share targets — similar to the
 * native iOS picker shown by other apps.
 *
 * Returns true if the native sheet was shown, false otherwise (caller should
 * then fall back to the in-app chooser).
 */
export const tryNativeMapsShare = async (
  lat: number | string,
  lng: number | string,
  label?: string
): Promise<boolean> => {
  if (!isIOSNative()) return false;
  try {
    const { Share } = await import('@capacitor/share');
    const can = await Share.canShare();
    if (!can.value) return false;
    await Share.share({
      title: label ? `Directions to ${label}` : 'Directions',
      url: appleMapsDirectionsUrl(lat, lng, label),
      dialogTitle: 'Open in Maps',
    });
    return true;
  } catch (err) {
    console.log('[openDirections] Native share unavailable:', err);
    return false;
  }
};
