import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { saveBranchId, getSavedBranchId, dispatchBranchChanged } from '@/lib/branch';
import { STORAGE_KEYS } from '@/constants';
import { getCurrentPosition } from '@/lib/geolocation';

interface Branch {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const geocodeLocation = async (lat: number, lon: number): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke('geocode-location', {
      body: { latitude: lat, longitude: lon }
    });
    if (error) return 'Current location';
    return data?.address || 'Current location';
  } catch {
    return 'Current location';
  }
};

/**
 * Get user coordinates from all available sources:
 * 1. Selected location (manual search/pin)
 * 2. Saved address data
 * 3. Current location data (GPS cache)
 * 4. Fall back to live GPS
 */
const getUserCoordinates = async (): Promise<{ lat: number; lon: number; address?: string } | null> => {
  // 1. Check selected location (manual search or pin drop)
  try {
    const selectedRaw = localStorage.getItem(STORAGE_KEYS.SELECTED_LOCATION_DATA);
    if (selectedRaw) {
      const selected = JSON.parse(selectedRaw);
      if (selected.latitude && selected.longitude) {
        return { lat: selected.latitude, lon: selected.longitude, address: selected.address };
      }
    }
  } catch {}

  // 2. Check saved address data
  try {
    const savedRaw = localStorage.getItem(STORAGE_KEYS.SAVED_ADDRESS_DATA);
    if (savedRaw) {
      const saved = JSON.parse(savedRaw);
      if (saved.latitude && saved.longitude) {
        return { lat: saved.latitude, lon: saved.longitude, address: saved.address };
      }
    }
  } catch {}

  // 3. Check cached current location
  try {
    const currentRaw = localStorage.getItem(STORAGE_KEYS.CURRENT_LOCATION_DATA);
    if (currentRaw) {
      const current = JSON.parse(currentRaw);
      if (current.latitude && current.longitude) {
        return { lat: current.latitude, lon: current.longitude, address: current.address };
      }
    }
  } catch {}

  // 4. Fall back to live GPS
  try {
    const position = await getCurrentPosition({
      timeout: 10000,
      enableHighAccuracy: true,
    });
    const { latitude, longitude } = position.coords;
    const address = await geocodeLocation(latitude, longitude);
    
    // Cache the GPS result
    localStorage.setItem(STORAGE_KEYS.DELIVERY_ADDRESS, 'current-location');
    localStorage.setItem(STORAGE_KEYS.CURRENT_LOCATION_DATA, JSON.stringify({
      address, latitude, longitude,
    }));
    window.dispatchEvent(new Event('addressChanged'));
    
    return { lat: latitude, lon: longitude, address };
  } catch {
    return null;
  }
};

const findAndSetNearestBranch = async (userLat: number, userLon: number) => {
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, latitude, longitude, address, city')
    .eq('is_active', true);

  if (!branches?.length) return;

  // Geocode branches missing coordinates
  const resolvedBranches: Array<{ id: string; name: string; latitude: number; longitude: number }> = [];

  for (const branch of branches) {
    if (branch.latitude && branch.longitude) {
      resolvedBranches.push({
        id: branch.id,
        name: branch.name,
        latitude: branch.latitude,
        longitude: branch.longitude,
      });
    } else if (branch.address) {
      try {
        const searchAddr = branch.city
          ? `${branch.address}, ${branch.city}`
          : branch.address;
        const { data } = await supabase.functions.invoke('geocode-location', {
          body: { address: searchAddr },
        });
        if (data?.latitude && data?.longitude) {
          resolvedBranches.push({
            id: branch.id,
            name: branch.name,
            latitude: data.latitude,
            longitude: data.longitude,
          });
          // Persist for future use
          supabase
            .from('branches')
            .update({ latitude: data.latitude, longitude: data.longitude })
            .eq('id', branch.id)
            .then(() => {});
        }
      } catch {}
    }
  }

  if (!resolvedBranches.length) return;

  let nearestBranch: (typeof resolvedBranches)[0] | null = null;
  let minDistance = Infinity;

  resolvedBranches.forEach((branch) => {
    const distance = calculateDistance(userLat, userLon, branch.latitude, branch.longitude);
    if (distance < minDistance) {
      minDistance = distance;
      nearestBranch = branch;
    }
  });

  if (nearestBranch) {
    const currentBranchId = getSavedBranchId();
    if (currentBranchId !== nearestBranch.id) {
      saveBranchId(nearestBranch.id);
      dispatchBranchChanged();
      console.log(`Auto-selected nearest branch: ${nearestBranch.name} (${minDistance.toFixed(2)}km)`);
    }
  }
};

export const useNearestBranch = () => {
  useEffect(() => {
    const detectAndSetNearestBranch = async () => {
      const coords = await getUserCoordinates();
      if (!coords) return;
      await findAndSetNearestBranch(coords.lat, coords.lon);
    };

    // Only auto-detect on initial mount if NO branch has been manually selected yet
    const savedBranchId = getSavedBranchId();
    if (!savedBranchId) {
      detectAndSetNearestBranch();
    }

    // Re-run when address changes (user picks new delivery address)
    const handleAddressChanged = () => {
      detectAndSetNearestBranch();
    };

    window.addEventListener('addressChanged', handleAddressChanged);
    return () => {
      window.removeEventListener('addressChanged', handleAddressChanged);
    };
  }, []);
};
