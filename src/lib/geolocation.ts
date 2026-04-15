import { Capacitor } from '@capacitor/core';

/**
 * Unified geolocation helper that uses the Capacitor Geolocation plugin
 * on native platforms (iOS/Android) and falls back to the browser
 * navigator.geolocation API on the web.
 *
 * On native iOS, using the Capacitor plugin avoids the duplicate
 * WKWebView "localhost" permission dialog — only the single native
 * iOS prompt (configured via Info.plist) is shown.
 */

interface Position {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
}

interface PositionOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

/**
 * Get the current position using Capacitor on native, browser API on web.
 */
export async function getCurrentPosition(options?: PositionOptions): Promise<Position> {
  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import('@capacitor/geolocation');
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: options?.enableHighAccuracy ?? true,
      timeout: options?.timeout ?? 10000,
    });
    return pos;
  }

  // Web fallback
  return new Promise<Position>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos as Position),
      reject,
      options,
    );
  });
}

/**
 * Check if geolocation is available on this platform.
 */
export function isGeolocationAvailable(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return !!navigator.geolocation;
}

/**
 * Watch position (continuous tracking). Returns an ID that can be passed
 * to clearWatch().
 *
 * On native, returns a Capacitor watch callback ID (string).
 * On web, returns a browser watchPosition number (wrapped as string for consistency).
 */
export async function watchPosition(
  successCallback: (position: Position) => void,
  errorCallback?: (error: any) => void,
  options?: PositionOptions,
): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import('@capacitor/geolocation');
    const id = await Geolocation.watchPosition(
      {
        enableHighAccuracy: options?.enableHighAccuracy ?? true,
        timeout: options?.timeout ?? 5000,
      },
      (position, err) => {
        if (err) {
          errorCallback?.(err);
        } else if (position) {
          successCallback(position as Position);
        }
      },
    );
    return id;
  }

  // Web fallback
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => successCallback(pos as Position),
      (err) => errorCallback?.(err),
      options,
    );
    resolve(String(id));
  });
}

/**
 * Clear a watch started via watchPosition().
 */
export async function clearWatch(watchId: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import('@capacitor/geolocation');
    await Geolocation.clearWatch({ id: watchId });
    return;
  }
  navigator.geolocation.clearWatch(Number(watchId));
}
