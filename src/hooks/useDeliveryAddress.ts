import { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEYS } from '@/constants';

interface DeliveryLocation {
  type: 'device' | 'saved';
  address?: string;
  addressId?: string;
  latitude?: number;
  longitude?: number;
  label?: string;
}

interface LocationData {
  address: string;
  latitude?: number;
  longitude?: number;
  label?: string;
}

/**
 * Unified hook to manage THE SINGLE delivery address across the entire app.
 * - Default: Current location (auto-detected on app launch)
 * - User can switch to saved addresses
 * - Same address displayed on Home, Menu, and Checkout pages
 */
export const useDeliveryAddress = () => {
  const [deliveryAddress, setDeliveryAddress] = useState<string>('Set delivery address');
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [selectedType, setSelectedType] = useState<'current-location' | string>('current-location');
  const [addressLabel, setAddressLabel] = useState<string | undefined>(undefined);

  // Load the current delivery address from localStorage
  const loadAddress = useCallback(() => {
    const savedAddressKey = localStorage.getItem(STORAGE_KEYS.DELIVERY_ADDRESS);
    
    if (savedAddressKey === 'current-location' || !savedAddressKey) {
      // Current location mode
      const currentLocData = localStorage.getItem(STORAGE_KEYS.CURRENT_LOCATION_DATA);
      if (currentLocData) {
        try {
          const parsed = JSON.parse(currentLocData);
          setDeliveryAddress(parsed.address || 'Current location');
          setLocationData(parsed);
          setSelectedType('current-location');
          setAddressLabel(undefined);
        } catch {
          setDeliveryAddress('Current location');
          setSelectedType('current-location');
          setAddressLabel(undefined);
        }
      } else {
        setDeliveryAddress('Set delivery address');
        setSelectedType('current-location');
        setAddressLabel(undefined);
      }
    } else if (savedAddressKey === 'selected-location') {
      // Selected location mode (from search/pin)
      const selectedLocData = localStorage.getItem(STORAGE_KEYS.SELECTED_LOCATION_DATA);
      if (selectedLocData) {
        try {
          const parsed = JSON.parse(selectedLocData);
          setDeliveryAddress(parsed.address || 'Selected location');
          setLocationData({
            address: parsed.address,
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            label: 'Selected Location',
          });
          setSelectedType('selected-location');
          setAddressLabel('Selected Location');
        } catch {
          setDeliveryAddress('Selected location');
          setSelectedType('selected-location');
          setAddressLabel('Selected Location');
        }
      } else {
        setDeliveryAddress('Set delivery address');
        setSelectedType('current-location');
        setAddressLabel(undefined);
      }
    } else {
      // Saved address mode - check saved address data first
      const savedAddressData = localStorage.getItem(STORAGE_KEYS.SAVED_ADDRESS_DATA);
      if (savedAddressData) {
        try {
          const parsed = JSON.parse(savedAddressData);
          if (parsed.id === savedAddressKey) {
            setDeliveryAddress(parsed.address);
            setLocationData({
              address: parsed.address,
              latitude: parsed.latitude,
              longitude: parsed.longitude,
              label: parsed.label,
            });
            setSelectedType(savedAddressKey);
            setAddressLabel(parsed.label);
            return;
          }
        } catch {
          // Fall through to local addresses check
        }
      }
      
      // Fallback: check local addresses
      const savedAddresses = localStorage.getItem(STORAGE_KEYS.LOCAL_DELIVERY_ADDRESSES);
      if (savedAddresses) {
        try {
          const addresses = JSON.parse(savedAddresses);
          const selected = addresses.find((a: any) => a.id === savedAddressKey);
          if (selected) {
            const displayAddress = `${selected.address_line1}, ${selected.city}`;
            setDeliveryAddress(displayAddress);
            setLocationData({
              address: displayAddress,
              latitude: selected.latitude,
              longitude: selected.longitude,
              label: selected.label,
            });
            setSelectedType(savedAddressKey);
            setAddressLabel(selected.label);
            return;
          }
        } catch {
          // Fall through to default
        }
      }
      // Fallback
      setDeliveryAddress('Set delivery address');
      setSelectedType('current-location');
      setAddressLabel(undefined);
    }
  }, []);

  // Load on mount and listen for changes across all pages
  useEffect(() => {
    loadAddress();

    const handleAddressChange = () => {
      loadAddress();
    };

    window.addEventListener('addressChanged', handleAddressChange);
    window.addEventListener('storage', handleAddressChange);

    return () => {
      window.removeEventListener('addressChanged', handleAddressChange);
      window.removeEventListener('storage', handleAddressChange);
    };
  }, [loadAddress]);

  // Handle location selection - updates the SINGLE delivery address variable
  const handleLocationSelect = useCallback((location: DeliveryLocation) => {
    if (location.type === 'device') {
      // Check if this is actually a search/pin source
      const source = (location as any).source;
      if (source === 'search' || source === 'pin') {
        // Save as selected location
        localStorage.setItem(STORAGE_KEYS.DELIVERY_ADDRESS, 'selected-location');
        
        const newLocationData: LocationData = {
          address: location.address || 'Selected location',
          latitude: location.latitude,
          longitude: location.longitude,
          label: 'Selected Location',
        };
        
        localStorage.setItem(STORAGE_KEYS.SELECTED_LOCATION_DATA, JSON.stringify(newLocationData));
        setDeliveryAddress(newLocationData.address);
        setLocationData(newLocationData);
        setSelectedType('selected-location');
        setAddressLabel('Selected Location');
      } else {
        // Actual device location
        localStorage.setItem(STORAGE_KEYS.DELIVERY_ADDRESS, 'current-location');
        
        const newLocationData: LocationData = {
          address: location.address || 'Current location',
          latitude: location.latitude,
          longitude: location.longitude,
        };
        
        localStorage.setItem(STORAGE_KEYS.CURRENT_LOCATION_DATA, JSON.stringify(newLocationData));
        setDeliveryAddress(newLocationData.address);
        setLocationData(newLocationData);
        setSelectedType('current-location');
        setAddressLabel(undefined);
      }
    } else if (location.addressId) {
      // Set to saved address
      localStorage.setItem(STORAGE_KEYS.DELIVERY_ADDRESS, location.addressId);
      
      if (location.address) {
        const newLocationData: LocationData = {
          address: location.address,
          latitude: location.latitude,
          longitude: location.longitude,
          label: location.label,
        };
        localStorage.setItem(STORAGE_KEYS.SAVED_ADDRESS_DATA, JSON.stringify({
          id: location.addressId,
          address: location.address,
          latitude: location.latitude,
          longitude: location.longitude,
          label: location.label,
        }));
        setDeliveryAddress(location.address);
        setLocationData(newLocationData);
        setSelectedType(location.addressId);
        setAddressLabel(location.label);
      }
    }

    // Trigger updates across ALL pages
    window.dispatchEvent(new Event('addressChanged'));
  }, []);

  const isCurrentLocation = selectedType === 'current-location';

  return {
    deliveryAddress,      // Display string for the current address
    locationData,         // Full location data with coordinates
    selectedType,         // 'current-location' or address ID
    addressLabel,         // Label of the address (Home, Office, etc.)
    isCurrentLocation,    // Boolean for easy icon selection
    handleLocationSelect, // Function to update the address
    loadAddress,          // Function to reload from storage
  };
};
