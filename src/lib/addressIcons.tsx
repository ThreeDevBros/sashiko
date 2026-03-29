import { Home, Building2, Briefcase, Building, MapPin, MapPinned, Navigation, type LucideIcon } from 'lucide-react';

export const ADDRESS_LABEL_ICONS: Record<string, LucideIcon> = {
  'Home': Home,
  'Apartment': Building2,
  'Office': Briefcase,
  'Work': Building,
  'Selected Location': MapPinned,
  'Pinned Location': MapPinned,
};

/**
 * Get the appropriate icon for an address based on its label.
 * Returns Navigation for current location, MapPinned for selected/pinned locations,
 * or a label-specific icon for saved addresses.
 */
export const getAddressIcon = (label: string | undefined, isCurrentLocation: boolean): LucideIcon => {
  if (isCurrentLocation) {
    return Navigation;
  }
  
  if (label && ADDRESS_LABEL_ICONS[label]) {
    return ADDRESS_LABEL_ICONS[label];
  }
  
  // Default icon for custom labels or unknown types
  return MapPin;
};
