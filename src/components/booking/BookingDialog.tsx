import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface LayoutObject {
  id: string;
  type: string;
  seats?: number;
  label?: string;
}

interface BookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: LayoutObject;
  branchId: string;
  branchName: string;
  initialPartySize?: number;
  requiresTableCombination?: boolean;
  selectedDate?: Date;
  selectedTime?: string;
  onReservationComplete?: () => void;
}

interface ValidationErrors {
  name?: string;
  email?: string;
  phone?: string;
}

export const BookingDialog = ({
  open,
  onOpenChange,
  table,
  branchId,
  branchName,
  initialPartySize,
  requiresTableCombination,
  selectedDate,
  selectedTime,
  onReservationComplete,
}: BookingDialogProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  // Auto-fill logged-in user info when dialog opens
  useEffect(() => {
    if (!open) return;
    
    const prefillUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setGuestEmail(prev => prev || user.email || '');

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', user.id)
        .single();

      if (profile) {
        setGuestName(prev => prev || profile.full_name || '');
        setGuestPhone(prev => prev || profile.phone || '');
      }
    };

    prefillUserData();
  }, [open]);

  // Reset fields when dialog closes so next open re-prefills
  useEffect(() => {
    if (!open) {
      setGuestName('');
      setGuestEmail('');
      setGuestPhone('');
      setSpecialRequests('');
      setValidationErrors({});
    }
  }, [open]);

  const partySize = initialPartySize || table.seats || 2;

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Clear individual errors as user types
  useEffect(() => {
    if (guestName.trim().length >= 2 && validationErrors.name) {
      setValidationErrors(prev => ({ ...prev, name: undefined }));
    }
  }, [guestName]);
  useEffect(() => {
    if (isValidEmail(guestEmail.trim()) && validationErrors.email) {
      setValidationErrors(prev => ({ ...prev, email: undefined }));
    }
  }, [guestEmail]);
  useEffect(() => {
    if (guestPhone.trim().length >= 6 && validationErrors.phone) {
      setValidationErrors(prev => ({ ...prev, phone: undefined }));
    }
  }, [guestPhone]);

  const validateAndScrollToErrors = useCallback(() => {
    const errors: ValidationErrors = {};
    if (!guestName.trim() || guestName.trim().length < 2) errors.name = 'Please enter your full name.';
    if (!guestEmail.trim() || !isValidEmail(guestEmail.trim())) errors.email = 'Please enter a valid email address.';
    if (!guestPhone.trim() || guestPhone.trim().length < 6) errors.phone = 'Please enter a valid phone number.';

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      // Find first error field and scroll/focus
      const firstErrorField = errors.name ? 'booking-name' : errors.email ? 'booking-email' : 'booking-phone';
      setTimeout(() => {
        const el = document.getElementById(firstErrorField);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
      }, 50);
      return false;
    }
    return true;
  }, [guestName, guestEmail, guestPhone]);

  const handleConfirmClick = () => {
    if (!selectedDate || !selectedTime) {
      toast({ title: 'Missing selection', description: 'Please select a date and time on the booking page.', variant: 'destructive' });
      return;
    }
    if (!validateAndScrollToErrors()) return;
    bookingMutation.mutate();
  };

  const bookingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate) throw new Error('Please select a date on the booking page');
      if (!selectedTime) throw new Error('Please select a time on the booking page');

      const { data, error } = await supabase.functions.invoke('create-booking', {
        body: {
          branch_id: branchId,
          table_object_id: table.id,
          guest_name: guestName.trim(),
          guest_email: guestEmail.trim(),
          guest_phone: guestPhone.trim(),
          party_size: partySize,
          reservation_date: format(selectedDate, 'yyyy-MM-dd'),
          start_time: selectedTime,
          special_requests: specialRequests.trim() || undefined,
          requires_table_combination: requiresTableCombination || false,
        },
      });

      if (error) {
        let errorMessage = 'Failed to create reservation. Please try again.';
        try {
          const context = await (error as any)?.context?.json?.();
          if (context?.error) errorMessage = context.error;
        } catch {
          if ((data as any)?.error) errorMessage = (data as any).error;
        }
        throw new Error(errorMessage);
      }

      if ((data as any)?.error) {
        throw new Error((data as any).error);
      }

      if (!(data as any)?.success) {
        throw new Error('Booking failed. Please try again.');
      }

      return data;
    },
    onSuccess: (data: any) => {
      // Save to localStorage for guest users if no authenticated user
      if (data?.booking?.id) {
        supabase.auth.getUser().then(({ data: authData }) => {
          if (!authData?.user) {
            import('@/lib/guestReservations').then(({ addGuestReservation }) => {
              addGuestReservation({
                id: data.booking.id,
                email: guestEmail.trim(),
                created_at: new Date().toISOString(),
              });
            });
          }
        });
      }

      const message = requiresTableCombination
        ? 'Large party request submitted! Admin will arrange tables and confirm your booking shortly.'
        : 'Reservation submitted! We will confirm your booking shortly.';
      toast({ title: 'Success!', description: message });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      onReservationComplete?.();
      navigate('/reservation-history');
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Failed to create reservation. Please check your details and try again.';
      toast({
        title: 'Booking failed',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-xl break-words">
            {requiresTableCombination ? 'Large Party Request' : `Reserve ${table.label || `Table ${table.id.split('-')[1]}`}`} at {branchName}
          </DialogTitle>
        </DialogHeader>

        {requiresTableCombination && (
          <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200 break-words">
              ⚠️ Your party size requires multiple tables. Our team will arrange seating and confirm availability.
            </p>
          </div>
        )}

        {/* Summary of selections from main page */}
        {selectedDate && selectedTime && (
          <div className="bg-muted/50 p-3 rounded-lg text-xs sm:text-sm space-y-1">
            <p><span className="text-muted-foreground">Party size:</span> <strong>{partySize} {partySize === 1 ? 'person' : 'people'}</strong></p>
            <p><span className="text-muted-foreground">Date:</span> <strong>{format(selectedDate, 'PPP')}</strong></p>
            <p><span className="text-muted-foreground">Time:</span> <strong>{selectedTime}</strong></p>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="booking-name" className="text-xs sm:text-sm">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="booking-name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Your name"
                className={`text-sm ${validationErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              />
              {validationErrors.name && (
                <p className="text-xs text-destructive mt-1">{validationErrors.name}</p>
              )}
            </div>
            <div>
              <Label htmlFor="booking-email" className="text-xs sm:text-sm">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="booking-email"
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="your@email.com"
                className={`text-sm ${validationErrors.email ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              />
              {validationErrors.email && (
                <p className="text-xs text-destructive mt-1">{validationErrors.email}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="booking-phone" className="text-xs sm:text-sm">
              Phone <span className="text-destructive">*</span>
            </Label>
            <Input
              id="booking-phone"
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="+1234567890"
              className={`text-sm ${validationErrors.phone ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            />
            {validationErrors.phone && (
              <p className="text-xs text-destructive mt-1">{validationErrors.phone}</p>
            )}
          </div>

          <div>
            <Label htmlFor="requests" className="text-xs sm:text-sm">Special Requests (optional)</Label>
            <Textarea
              id="requests"
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="Any dietary requirements or special occasions?"
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          <Button
            className="w-full text-sm sm:text-base"
            onClick={handleConfirmClick}
            disabled={bookingMutation.isPending}
          >
            {bookingMutation.isPending ? 'Submitting...' : 'Confirm Reservation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
