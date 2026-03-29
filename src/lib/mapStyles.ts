// Light mode map style - No labels, minimal design
export const lightMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", stylers: [{ visibility: "off" }] },
  { featureType: "landscape", stylers: [{ color: "#f8f9fa" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", stylers: [{ color: "#f1f3f5" }] },
  { featureType: "road.arterial", stylers: [{ color: "#e9ecef" }] },
  { featureType: "road.highway", stylers: [{ color: "#dee2e6" }] },
  { featureType: "road.local", stylers: [{ color: "#ffffff" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", stylers: [{ color: "#e3f2fd" }] },
];

// Dark mode map style - No labels, minimal design
export const darkMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", stylers: [{ visibility: "off" }] },
  { featureType: "landscape", stylers: [{ color: "#2d2d2d" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", stylers: [{ color: "#3a3a3a" }] },
  { featureType: "road.arterial", stylers: [{ color: "#4a4a4a" }] },
  { featureType: "road.highway", stylers: [{ color: "#5a5a5a" }] },
  { featureType: "road.local", stylers: [{ color: "#2d2d2d" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", stylers: [{ color: "#0d47a1" }] },
];

// Light mode detailed map style - Shows cities, roads with labels
export const lightMapStyleDetailed: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#333333" }] },
  { featureType: "administrative.neighborhood", elementType: "labels.text.fill", stylers: [{ color: "#666666" }] },
  { featureType: "landscape", stylers: [{ color: "#f8f9fa" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e8f5e9", visibility: "on" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#e9ecef" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadce0" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", stylers: [{ color: "#c8e6f5" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4a90c2" }] },
];

// Dark mode detailed map style - Shows cities, roads with labels, matches app dark theme
export const darkMapStyleDetailed: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#c0c0c0" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1a" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#e0e0e0" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#e0e0e0" }] },
  { featureType: "administrative.neighborhood", elementType: "labels.text.fill", stylers: [{ color: "#b0b0b0" }] },
  { featureType: "landscape", stylers: [{ color: "#2d2d2d" }] },
  { featureType: "landscape.natural", stylers: [{ color: "#252525" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1b3d1b", visibility: "on" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#333333" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#999999" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#3a3a3a" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#454545" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#c0c0c0" }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#2a2a2a" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", stylers: [{ color: "#0d47a1" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4fc3f7" }] },
];

// Get map style based on theme
export const getMapStyle = (isDark: boolean): google.maps.MapTypeStyle[] => {
  return isDark ? darkMapStyle : lightMapStyle;
};

// Get detailed map style based on theme (for address picker)
export const getDetailedMapStyle = (isDark: boolean): google.maps.MapTypeStyle[] => {
  return isDark ? darkMapStyleDetailed : lightMapStyleDetailed;
};

/**
 * Build an SVG data-URI marker.
 * Uses minimal SVG without <defs>/<style> blocks for maximum mobile compatibility.
 * All colours are inlined as attributes to avoid CSS-parsing quirks on WebViews.
 */
const buildSvgUrl = (svg: string): string =>
  'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg.replace(/\n\s*/g, ''));

// Custom marker icons as SVG data URIs — mobile-safe (no <style>, no <defs>)
export const mapMarkerIcons = {
  // Blue dot — user / delivery destination
  person: {
    url: buildSvgUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="23" fill="#4285F4" fill-opacity="0.15"/>
        <circle cx="24" cy="24" r="12" fill="white"/>
        <circle cx="24" cy="24" r="9" fill="#4285F4"/>
        <circle cx="24" cy="21" r="3" fill="white" fill-opacity="0.9"/>
        <path d="M18.5 30C18.5 27 21 24.5 24 24.5C27 24.5 29.5 27 29.5 30" fill="white" fill-opacity="0.9"/>
      </svg>
    `),
    scaledSize: { width: 48, height: 48 },
    anchor: { x: 24, y: 24 },
  },

  // Orange dot — restaurant / branch
  restaurant: {
    url: buildSvgUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="23" fill="#FF7A00" fill-opacity="0.15"/>
        <circle cx="24" cy="24" r="12" fill="white"/>
        <circle cx="24" cy="24" r="9" fill="#FF7A00"/>
        <g transform="translate(24,24)" fill="white">
          <g transform="translate(-4,-5.5)">
            <rect x="0" y="0" width="1" height="4.5" rx="0.5"/>
            <rect x="2" y="0" width="1" height="4.5" rx="0.5"/>
            <rect x="4" y="0" width="1" height="4.5" rx="0.5"/>
            <rect x="0" y="4" width="5" height="1.5" rx="0.75"/>
            <rect x="1.75" y="5.2" width="1.3" height="5.5" rx="0.65"/>
          </g>
          <g transform="translate(1.5,-5.5)">
            <path d="M2 0C2 0 4 1.6 4 4.3C4 5.5 3.2 6 2.6 6L2.6 11L1.4 11L1.4 6C0.8 6 0 5.5 0 4.3C0 1.6 2 0 2 0Z"/>
          </g>
        </g>
      </svg>
    `),
    scaledSize: { width: 48, height: 48 },
    anchor: { x: 24, y: 24 },
  },

  // Bright green dot — delivery driver with motorcycle
  driver: {
    url: buildSvgUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="23" fill="#22c55e" fill-opacity="0.18"/>
        <circle cx="24" cy="24" r="12" fill="white"/>
        <circle cx="24" cy="24" r="9" fill="#22c55e"/>
        <g transform="translate(24,24)" fill="none" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="-4.5" cy="2.5" r="2.2"/>
          <circle cx="4.5" cy="2.5" r="2.2"/>
          <path d="M-4.5 2.5L-2 -1.5L3 -1.5L4.5 2.5"/>
          <line x1="3" y1="-1.5" x2="4.5" y2="-3.5"/>
        </g>
        <circle cx="24" cy="20.5" r="1.6" fill="white"/>
      </svg>
    `),
    scaledSize: { width: 48, height: 48 },
    anchor: { x: 24, y: 24 },
  },
};

// Helper function to create marker icon object
export const createMarkerIcon = (type: 'person' | 'restaurant' | 'driver'): google.maps.Icon => {
  const iconData = mapMarkerIcons[type];
  return {
    url: iconData.url,
    scaledSize: new google.maps.Size(iconData.scaledSize.width, iconData.scaledSize.height),
    anchor: new google.maps.Point(iconData.anchor.x, iconData.anchor.y),
  };
};

/**
 * Utility: wait for a container element to have non-zero dimensions.
 * Uses ResizeObserver with a timeout fallback.
 * Returns true if the container is ready, false if it timed out.
 */
export const waitForContainerReady = (
  container: HTMLElement,
  timeoutMs = 3000
): Promise<boolean> => {
  return new Promise((resolve) => {
    // Already has dimensions
    if (container.offsetWidth > 0 && container.offsetHeight > 0) {
      resolve(true);
      return;
    }

    let resolved = false;
    const finish = (val: boolean) => {
      if (resolved) return;
      resolved = true;
      observer?.disconnect();
      clearTimeout(timer);
      resolve(val);
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          finish(true);
        }
      }
    });
    observer.observe(container);

    const timer = setTimeout(() => finish(false), timeoutMs);
  });
};

/**
 * Trigger multiple resize events on a map to ensure proper rendering on mobile.
 */
export const triggerMapResize = (mapInstance: google.maps.Map) => {
  const delays = [50, 150, 300, 600, 1200];
  delays.forEach((ms) => {
    setTimeout(() => {
      try {
        google.maps.event.trigger(mapInstance, 'resize');
      } catch {
        // Map may have been destroyed
      }
    }, ms);
  });
};
