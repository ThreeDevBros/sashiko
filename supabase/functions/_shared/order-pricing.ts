/**
 * Authoritative server-side order pricing.
 *
 * Never trust client-supplied subtotal, tax, delivery fee or service fee.
 * Everything here is recomputed from menu_items / branch_menu_items /
 * tenant_settings / branches.
 */

export interface RequestedItem {
  id: string;
  quantity: number;
}

export interface VerifiedItem {
  price: number;
  name: string;
  tax_rate: number | null;
  tax_included_in_price: boolean;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Fetch authoritative item data (price + tax config) from the database. */
export async function loadVerifiedItems(
  admin: any,
  items: RequestedItem[],
  branchId: string | null | undefined,
): Promise<Map<string, VerifiedItem>> {
  const ids = items.map((i) => i.id);

  const { data: dbItems, error } = await admin
    .from('menu_items')
    .select('id, price, name, tax_rate, tax_included_in_price')
    .in('id', ids);

  if (error || !dbItems) throw new Error('Failed to verify item prices.');

  const map = new Map<string, VerifiedItem>();
  for (const it of dbItems) {
    map.set(it.id, {
      price: Number(it.price),
      name: it.name,
      tax_rate: it.tax_rate != null ? Number(it.tax_rate) : null,
      tax_included_in_price: Boolean(it.tax_included_in_price),
    });
  }

  if (branchId) {
    const { data: branchItems } = await admin
      .from('branch_menu_items')
      .select('menu_item_id, price_override')
      .eq('branch_id', branchId)
      .in('menu_item_id', ids)
      .not('price_override', 'is', null);

    for (const bi of branchItems ?? []) {
      const existing = map.get(bi.menu_item_id);
      if (existing) map.set(bi.menu_item_id, { ...existing, price: Number(bi.price_override) });
    }
  }

  for (const item of items) {
    if (!map.has(item.id)) throw new Error(`Menu item not found: ${item.id}`);
  }

  return map;
}

export interface PricingResult {
  itemMap: Map<string, VerifiedItem>;
  subtotal: number;
  tax: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
  currency: string;
}

/**
 * Recompute the full order total server-side.
 * `clientDeliveryFee` is only used as an upper hint when destination
 * coordinates are unavailable — it can never lower the server fee.
 */
export async function computeOrderPricing(
  admin: any,
  opts: {
    items: RequestedItem[];
    branchId?: string | null;
    orderType: 'delivery' | 'pickup' | 'dine_in';
    deliveryAddressId?: string | null;
    destLat?: number | null;
    destLng?: number | null;
    clientDeliveryFee?: number;
  },
): Promise<PricingResult> {
  const itemMap = await loadVerifiedItems(admin, opts.items, opts.branchId);

  const { data: settings } = await admin
    .from('tenant_settings')
    .select(
      'vat_rate, service_fee_rate, currency, delivery_base_fee, delivery_fee_per_km, free_delivery_threshold, max_delivery_fee, min_delivery_fee',
    )
    .limit(1)
    .maybeSingle();

  const globalTaxRate = Number(settings?.vat_rate ?? 0) || 0;
  const serviceFeeRate = Number(settings?.service_fee_rate ?? 0) || 0;

  let subtotal = 0;
  let tax = 0;
  for (const item of opts.items) {
    const v = itemMap.get(item.id)!;
    const rate = v.tax_rate ?? globalTaxRate;
    const lineTotal = v.price * item.quantity;
    if (v.tax_included_in_price) {
      const taxAmount = lineTotal - lineTotal / (1 + rate / 100);
      subtotal += lineTotal - taxAmount;
      tax += taxAmount;
    } else {
      subtotal += lineTotal;
      tax += lineTotal * (rate / 100);
    }
  }
  subtotal = round2(subtotal);
  tax = round2(tax);

  let deliveryFee = 0;
  if (opts.orderType === 'delivery') {
    const baseFee = Number(settings?.delivery_base_fee ?? 0) || 0;
    const perKm = Number(settings?.delivery_fee_per_km ?? 0) || 0;
    const minFee = Number(settings?.min_delivery_fee ?? 0) || 0;
    const maxFee = settings?.max_delivery_fee != null ? Number(settings.max_delivery_fee) : null;
    const freeThreshold =
      settings?.free_delivery_threshold != null ? Number(settings.free_delivery_threshold) : null;

    // Resolve destination coordinates
    let lat = opts.destLat ?? null;
    let lng = opts.destLng ?? null;

    if ((lat == null || lng == null) && opts.deliveryAddressId) {
      const { data: addr } = await admin
        .from('user_addresses')
        .select('latitude, longitude')
        .eq('id', opts.deliveryAddressId)
        .maybeSingle();
      if (addr?.latitude != null && addr?.longitude != null) {
        lat = Number(addr.latitude);
        lng = Number(addr.longitude);
      }
    }

    let branchLat: number | null = null;
    let branchLng: number | null = null;
    if (opts.branchId) {
      const { data: branch } = await admin
        .from('branches')
        .select('latitude, longitude')
        .eq('id', opts.branchId)
        .maybeSingle();
      if (branch?.latitude != null && branch?.longitude != null) {
        branchLat = Number(branch.latitude);
        branchLng = Number(branch.longitude);
      }
    }

    if (freeThreshold != null && subtotal >= freeThreshold) {
      deliveryFee = 0;
    } else {
      let distanceKm: number | null = null;
      if (lat != null && lng != null && branchLat != null && branchLng != null) {
        distanceKm = haversineKm(branchLat, branchLng, lat, lng);
      }

      let fee = baseFee + (distanceKm ?? 0) * perKm;
      fee = Math.max(fee, minFee);
      if (maxFee != null) fee = Math.min(fee, maxFee);
      fee = round2(fee);

      if (distanceKm == null && opts.clientDeliveryFee != null) {
        // Distance unknown: allow the client value only if it is HIGHER
        // (never let a caller lower the fee), still capped by max_delivery_fee.
        let hinted = opts.clientDeliveryFee;
        if (maxFee != null) hinted = Math.min(hinted, maxFee);
        fee = Math.max(fee, round2(hinted));
      }

      deliveryFee = fee;
    }
  }

  const serviceFee = round2(subtotal * (serviceFeeRate / 100));
  const total = round2(subtotal + tax + deliveryFee + serviceFee);

  return {
    itemMap,
    subtotal,
    tax,
    deliveryFee,
    serviceFee,
    total,
    currency: (settings?.currency as string) || 'usd',
  };
}
