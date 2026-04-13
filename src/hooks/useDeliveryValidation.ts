import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateDistance } from '@/lib/distance';
import { useBranch } from './useBranch';

interface DeliveryValidationResult {
  canDeliver: boolean;
  distance: number | null;
  selectedAddress: {
    id: string;
    address_line1: string;
    city: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
}

export const useDeliveryValidation = () => {
  const { branch } = useBranch();
  const [validation, setValidation] = useState<DeliveryValidationResult>({
    canDeliver: true,
    distance: null,
    selectedAddress: null,
  });
  const [loading, setLoading] = useState(true);
  const [validationTrigger, setValidationTrigger] = useState(0);

  useEffect(() => {
    const checkDeliveryAvailability = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;
        
        if (!user || !branch) {
          setValidation({
            canDeliver: true,
            distance: null,
            selectedAddress: null,
          });
          setLoading(false);
          return;
        }

        // Get selected address from localStorage
        const selectedAddressId = localStorage.getItem('selectedDeliveryAddress');
        
        if (!selectedAddressId) {
          setValidation({
            canDeliver: true,
            distance: null,
            selectedAddress: null,
          });
          setLoading(false);
          return;
        }

        // Fetch the address
        const { data: address, error } = await supabase
          .from('user_addresses')
          .select('*')
          .eq('id', selectedAddressId)
          .single();

        if (error || !address) {
          setValidation({
            canDeliver: true,
            distance: null,
            selectedAddress: null,
          });
          setLoading(false);
          return;
        }

        // Check if we have coordinates for both branch and address
        if (
          !branch.latitude || 
          !branch.longitude || 
          !address.latitude || 
          !address.longitude
        ) {
          setValidation({
            canDeliver: true,
            distance: null,
            selectedAddress: address,
          });
          setLoading(false);
          return;
        }

        // Calculate distance
        const distance = calculateDistance(
          branch.latitude,
          branch.longitude,
          address.latitude,
          address.longitude
        );

        // Check if within delivery radius
        const deliveryRadius = branch.delivery_radius_km || 10; // Default 10km
        const canDeliver = distance <= deliveryRadius;

        setValidation({
          canDeliver,
          distance,
          selectedAddress: address,
        });
      } catch (error) {
        console.error('Error checking delivery availability:', error);
        setValidation({
          canDeliver: true,
          distance: null,
          selectedAddress: null,
        });
      } finally {
        setLoading(false);
      }
    };

    checkDeliveryAvailability();
  }, [branch, validationTrigger]);

  useEffect(() => {
    // Re-check when address changes
    const handleAddressChange = () => {
      setValidationTrigger(prev => prev + 1);
    };

    window.addEventListener('storage', handleAddressChange);
    window.addEventListener('addressChanged', handleAddressChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleAddressChange);
      window.removeEventListener('addressChanged', handleAddressChange as EventListener);
    };
  }, []);

  return { ...validation, loading };
};
