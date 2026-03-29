import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig } from '@/components/ui/chart';
import { ChartContainer } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { ReactElement, cloneElement, useState } from 'react';
import { Expand } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ResponsiveChartCardProps {
  title: string;
  subtitle?: string;
  config: ChartConfig;
  children: ReactElement;
  className?: string;
  /** Extra classes on the ChartContainer height, defaults to responsive breakpoints */
  heightClass?: string;
}

/**
 * Shared responsive chart card used across all admin/staff pages.
 * Prevents overflow on mobile by enforcing min-w-0, overflow-hidden,
 * responsive heights, and reduced padding on small screens.
 * Click/tap to expand chart in a full modal.
 */
export function ResponsiveChartCard({
  title,
  subtitle,
  config,
  children,
  className,
  heightClass = 'h-[220px] sm:h-[280px] lg:h-[300px]',
}: ResponsiveChartCardProps) {
  const [open, setOpen] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <>
      <Card
        className={cn(
          'overflow-hidden min-w-0 cursor-pointer transition-shadow hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 outline-none group',
          className,
        )}
        role="button"
        tabIndex={0}
        aria-label={`Expand chart: ${title}`}
        onClick={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      >
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm sm:text-base">{title}</CardTitle>
          <Expand className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </CardHeader>
        <CardContent className="px-1 sm:px-4 lg:px-6">
          <ChartContainer config={config} className={cn(heightClass, 'w-full')}>
            {children}
          </ChartContainer>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[90vw] lg:max-w-[1100px] h-[90vh] sm:h-[85vh] flex flex-col p-3 sm:p-6">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-base sm:text-lg">{title}</DialogTitle>
            {subtitle && (
              <DialogDescription>{subtitle}</DialogDescription>
            )}
            {!subtitle && <DialogDescription className="sr-only">Expanded view of {title}</DialogDescription>}
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            <ChartContainer config={config} className="w-full h-full">
              {children}
            </ChartContainer>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
