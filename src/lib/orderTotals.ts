import type { CartItem } from '@/contexts/CartContext';

/**
 * Per-item tax aware subtotal/tax split.
 *
 * Items can either include tax in their price (extract it) or exclude it
 * (add on top), and each item may override the global rate. This mirrors the
 * calculation used when the order is persisted, so cart and checkout can never
 * show different numbers.
 */
export function computeItemTotals(
  items: Pick<CartItem, 'price' | 'quantity' | 'tax_rate' | 'tax_included_in_price'>[],
  globalTaxRate: number,
): { subtotal: number; tax: number } {
  let subtotal = 0;
  let tax = 0;

  items.forEach((item) => {
    const rate = item.tax_rate ?? globalTaxRate;
    const lineTotal = item.price * item.quantity;

    if (item.tax_included_in_price) {
      const taxAmount = lineTotal - lineTotal / (1 + rate / 100);
      subtotal += lineTotal - taxAmount;
      tax += taxAmount;
    } else {
      subtotal += lineTotal;
      tax += lineTotal * (rate / 100);
    }
  });

  return { subtotal, tax };
}
