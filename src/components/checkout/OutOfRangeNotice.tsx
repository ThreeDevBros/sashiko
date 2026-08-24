import { MapPinOff } from 'lucide-react';

/**
 * Minimal warning shown when the chosen delivery address sits outside
 * the branch radius. The map and the amber address-card ring already
 * communicate the problem, so this keeps the copy to a single headline.
 */
export const OutOfRangeNotice = () => (
  <div className="mt-4 rounded-2xl border border-yellow-500/50 bg-yellow-500/5 p-4">
    <div className="flex items-center gap-3">
      <MapPinOff className="h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
      <p className="font-display text-base font-semibold text-yellow-700 dark:text-yellow-400">
        Address outside delivery area
      </p>
    </div>
  </div>
);
