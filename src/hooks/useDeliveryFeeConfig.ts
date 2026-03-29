import { useQuery } from '@tanstack/react-query';
import { fetchDeliveryFeeConfig, type DeliveryFeeConfig } from '@/lib/deliveryFee';

export function useDeliveryFeeConfig() {
  const { data: deliveryFeeConfig = null } = useQuery<DeliveryFeeConfig | null>({
    queryKey: ['delivery-fee-config'],
    queryFn: fetchDeliveryFeeConfig,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return deliveryFeeConfig;
}
