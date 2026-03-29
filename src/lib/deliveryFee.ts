import { supabase } from '@/integrations/supabase/client';

export interface DeliveryFeeConfig {
  delivery_base_fee: number;
  delivery_fee_per_km: number;
  free_delivery_threshold: number | null;
  max_delivery_fee: number | null;
  min_delivery_fee: number;
}

/**
 * Calculate delivery fee based on distance and tenant settings
 * Formula: base_fee + (distance_km * fee_per_km)
 * Clamped between min and max, waived if order meets free threshold
 */
export function calculateDeliveryFee(
  distanceKm: number,
  config: DeliveryFeeConfig,
  orderSubtotal?: number
): number {
  // Check free delivery threshold
  if (
    config.free_delivery_threshold != null &&
    orderSubtotal != null &&
    orderSubtotal >= config.free_delivery_threshold
  ) {
    return 0;
  }

  let fee = config.delivery_base_fee + distanceKm * config.delivery_fee_per_km;

  // Apply min
  fee = Math.max(fee, config.min_delivery_fee);

  // Apply max
  if (config.max_delivery_fee != null) {
    fee = Math.min(fee, config.max_delivery_fee);
  }

  // Round to 2 decimal places
  return Math.round(fee * 100) / 100;
}

/**
 * Fetch delivery fee config from tenant_settings
 */
export async function fetchDeliveryFeeConfig(): Promise<DeliveryFeeConfig | null> {
  const { data, error } = await supabase
    .from('tenant_settings')
    .select('delivery_base_fee, delivery_fee_per_km, free_delivery_threshold, max_delivery_fee, min_delivery_fee')
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    delivery_base_fee: Number((data as any).delivery_base_fee) || 0,
    delivery_fee_per_km: Number((data as any).delivery_fee_per_km) || 0,
    free_delivery_threshold: (data as any).free_delivery_threshold != null ? Number((data as any).free_delivery_threshold) : null,
    max_delivery_fee: (data as any).max_delivery_fee != null ? Number((data as any).max_delivery_fee) : null,
    min_delivery_fee: Number((data as any).min_delivery_fee) || 0,
  };
}
