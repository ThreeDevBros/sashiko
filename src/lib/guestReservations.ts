// Manage guest reservations in localStorage for tracking and history

export interface GuestReservationEntry {
  id: string;
  email: string;
  created_at: string;
}

const STORAGE_KEY = 'guest_reservations';

export function getGuestReservations(): GuestReservationEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GuestReservationEntry[];
  } catch {
    return [];
  }
}

export function addGuestReservation(entry: GuestReservationEntry): void {
  const reservations = getGuestReservations();
  if (reservations.some(r => r.id === entry.id)) return;
  reservations.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations.slice(0, 50)));
}

export function removeGuestReservation(reservationId: string): void {
  const reservations = getGuestReservations().filter(r => r.id !== reservationId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
}
