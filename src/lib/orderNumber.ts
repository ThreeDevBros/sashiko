/**
 * Formats the sequential display_number (0–999) as a zero-padded 3-digit string.
 * Falls back to '000' if not available.
 */
export const formatOrderDisplayNumber = (displayNumber: number | null | undefined): string => {
  if (displayNumber == null) return '000';
  return displayNumber.toString().padStart(3, '0');
};
