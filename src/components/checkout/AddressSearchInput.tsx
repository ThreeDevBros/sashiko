import { useState, useCallback } from 'react';
import { LocationAutocompleteInput, type PlaceResult } from '@/components/LocationAutocompleteInput';
import { PinDropMapOverlay } from '@/components/PinDropMapOverlay';

interface SelectedAddress {
  address: string;
  latitude: number;
  longitude: number;
  city?: string;
  postalCode?: string;
  addressLine1?: string;
}

interface AddressSearchInputProps {
  onAddressSelected: (address: SelectedAddress) => void;
  placeholder?: string;
  /** When provided, disables the internal PinDropMapOverlay and delegates to the parent */
  onPinMapClick?: () => void;
}

/**
 * Checkout address search — now uses native Google Autocomplete widget.
 */
export const AddressSearchInput = ({
  onAddressSelected,
  placeholder = 'Search for address, area, or district…',
  onPinMapClick,
}: AddressSearchInputProps) => {
  const [pinMapOpen, setPinMapOpen] = useState(false);

  const handleSelect = useCallback((place: PlaceResult) => {
    onAddressSelected({
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      city: place.city,
      postalCode: place.postalCode,
      addressLine1: place.addressLine1,
    });
  }, [onAddressSelected]);

  // If parent provides onPinMapClick, delegate to it; otherwise use internal overlay
  const effectivePinMapClick = onPinMapClick ?? (() => setPinMapOpen(true));

  return (
    <>
      <LocationAutocompleteInput
        onSelect={handleSelect}
        placeholder={placeholder}
        autoFocus
        onPinMapClick={effectivePinMapClick}
      />
      {!onPinMapClick && (
        <PinDropMapOverlay
          open={pinMapOpen}
          onClose={() => setPinMapOpen(false)}
          onConfirm={handleSelect}
        />
      )}
    </>
  );
};
