import { supabase } from '@/integrations/supabase/client';

let apiKey: string | null = null;
let mapsReady = false;
let initPromise: Promise<string> | null = null;

/**
 * Centralized Google Maps loader.
 * Fetches the API key once, loads the script via dynamic <script> tag,
 * and resolves when the global `google.maps` object is available.
 *
 * Singleton pattern — safe to call from any number of components simultaneously.
 */
export async function loadGoogleMaps(_libraries?: string[]): Promise<string> {
  // Already fully loaded
  if (mapsReady && apiKey && typeof google !== 'undefined' && google.maps) {
    return apiKey;
  }

  // If a previous init failed, allow retry
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 1. Fetch the key from the edge function (only once)
      if (!apiKey) {
        const { data, error } = await supabase.functions.invoke('get-public-keys', {
          body: { key_type: 'GOOGLE_MAPS_API_KEY' },
        });
        if (error) throw new Error(`Failed to fetch Google Maps API key: ${error.message}`);
        if (!data?.key) throw new Error('No Google Maps API key configured.');
        apiKey = data.key;
      }

      // 2. If google.maps is already on the page (hot-reload, back-nav), done
      if (typeof google !== 'undefined' && google.maps) {
        mapsReady = true;
        return apiKey!;
      }

      // 3. Inject or wait for the script tag
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api"]');

        if (existing) {
          // Script tag exists — wait for google.maps
          const waitForApi = () => {
            if (typeof google !== 'undefined' && google.maps) return resolve();
            let attempts = 0;
            const poll = setInterval(() => {
              attempts++;
              if (typeof google !== 'undefined' && google.maps) {
                clearInterval(poll);
                resolve();
              } else if (attempts > 150) { // 15 seconds
                clearInterval(poll);
                reject(new Error('Google Maps script timed out'));
              }
            }, 100);
          };
          waitForApi();
          return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&v=weekly&loading=async`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          // google.maps may need an extra tick after onload
          let attempts = 0;
          const poll = setInterval(() => {
            attempts++;
            if (typeof google !== 'undefined' && google.maps) {
              clearInterval(poll);
              resolve();
            } else if (attempts > 100) { // 10 seconds
              clearInterval(poll);
              reject(new Error('Google Maps init timed out after script load'));
            }
          }, 100);
        };

        script.onerror = (e) => {
          // Remove broken script tag so retry can re-inject
          script.remove();
          reject(new Error('Failed to load Google Maps script — check network/CSP'));
        };

        document.head.appendChild(script);
      });

      mapsReady = true;
      return apiKey!;
    } catch (err) {
      // Allow retry on next call
      initPromise = null;
      mapsReady = false;
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Reset the loader state (useful for testing or forced retry).
 */
export function resetGoogleMapsLoader() {
  initPromise = null;
  mapsReady = false;
}
