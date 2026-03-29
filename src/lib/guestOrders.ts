// Manage guest orders in localStorage for tracking and history

export interface GuestOrderEntry {
  id: string;
  email: string;
  order_number: string;
  created_at: string;
}

const STORAGE_KEY = 'guest_orders';

export function getGuestOrders(): GuestOrderEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GuestOrderEntry[];
  } catch {
    return [];
  }
}

export function addGuestOrder(entry: GuestOrderEntry): void {
  const orders = getGuestOrders();
  // Avoid duplicates
  if (orders.some(o => o.id === entry.id)) return;
  orders.unshift(entry); // newest first
  // Keep last 50 orders max
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders.slice(0, 50)));
  
  // Also update the active order banner entry
  localStorage.setItem('guest_active_order', JSON.stringify({ id: entry.id, email: entry.email }));
}

export function removeGuestOrder(orderId: string): void {
  const orders = getGuestOrders().filter(o => o.id !== orderId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}
