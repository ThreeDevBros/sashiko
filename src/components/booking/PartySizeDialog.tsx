import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, ChevronDown, Calendar as CalendarIcon } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface PartySizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partySize: number;
  onPartySizeChange: (size: number) => void;
  onConfirm: () => void;
  selectedDate?: Date;
  onDateChange?: (date: Date | undefined) => void;
  selectedTime?: string;
  onTimeChange?: (time: string) => void;
}

export const PartySizeDialog = ({
  open,
  onOpenChange,
  partySize,
  onPartySizeChange,
  onConfirm,
  selectedDate,
  onDateChange,
  selectedTime,
  onTimeChange,
}: PartySizeDialogProps) => {
  const isMobile = useIsMobile();
  const canConfirm = partySize > 0 && !!selectedDate && !!selectedTime;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-xl">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span className="break-words">Reservation details</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="partySize" className="text-xs sm:text-base">Number of guests</Label>
            {isMobile ? (
              <div className="relative mt-2">
                <select
                  value={partySize}
                  onChange={(e) => onPartySizeChange(parseInt(e.target.value))}
                  className="w-full min-h-[48px] appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 pr-10"
                >
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'guest' : 'guests'}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
              </div>
            ) : (
              <Input
                id="partySize"
                type="number"
                min="1"
                max="20"
                value={partySize}
                onChange={(e) => onPartySizeChange(parseInt(e.target.value) || 1)}
                className="mt-2 text-sm sm:text-base"
              />
            )}
          </div>

          <div>
            <Label className="text-xs sm:text-base">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal mt-2 text-sm',
                    !selectedDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => onDateChange?.(d)}
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return date < today;
                  }}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label htmlFor="reservationTime" className="text-xs sm:text-base">Time</Label>
            <Input
              id="reservationTime"
              type="time"
              value={selectedTime || ''}
              onChange={(e) => onTimeChange?.(e.target.value)}
              className="mt-2 text-sm sm:text-base"
            />
          </div>

          <Button
            className="w-full text-sm sm:text-base"
            disabled={!canConfirm}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Find Available Tables
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
