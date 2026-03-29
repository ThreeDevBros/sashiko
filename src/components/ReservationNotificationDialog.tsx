import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Clock, Users, Mail, Phone, MessageSquare, TableProperties, CheckCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ReservationMiniMap } from '@/components/reservation/ReservationMiniMap';

interface Reservation {
  id: string;
  branch_id: string;
  table_object_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  party_size: number;
  reservation_date: string;
  start_time: string;
  end_time: string;
  special_requests?: string;
}

interface ReservationNotificationDialogProps {
  reservation: Reservation | null;
  onClose: () => void;
}

export const ReservationNotificationDialog = ({
  reservation,
  onClose,
}: ReservationNotificationDialogProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isOverlapping, setIsOverlapping] = useState(false);
  const [overlapMessage, setOverlapMessage] = useState('');
  const [isAccepting, setIsAccepting] = useState(false);
  const [tableName, setTableName] = useState<string>('');

  useEffect(() => {
    if (reservation) {
      setOpen(true);
      checkForOverlap();
      fetchTableName();
    }
  }, [reservation]);

  const fetchTableName = async () => {
    if (!reservation) return;
    
    try {
      // Fetch branch data to get layout and find table name
      const { data: branchData, error } = await supabase
        .from('branches')
        .select('layout_data')
        .eq('id', reservation.branch_id)
        .single();

      if (error) throw error;

      if (branchData?.layout_data) {
        const layoutData = branchData.layout_data as any;
        const table = layoutData.objects?.find((obj: any) => obj.id === reservation.table_object_id);
        setTableName(table?.label || reservation.table_object_id);
      } else {
        setTableName(reservation.table_object_id);
      }
    } catch (error) {
      console.error('Error fetching table name:', error);
      setTableName(reservation.table_object_id);
    }
  };

  const checkForOverlap = async () => {
    if (!reservation) return;

    try {
      const { data: overlappingReservations, error } = await supabase
        .from('table_reservations')
        .select('id, guest_name, start_time, end_time')
        .eq('branch_id', reservation.branch_id)
        .eq('table_object_id', reservation.table_object_id)
        .eq('reservation_date', reservation.reservation_date)
        .in('status', ['confirmed', 'pending'])
        .neq('id', reservation.id);

      if (error) throw error;

      if (overlappingReservations && overlappingReservations.length > 0) {
        // Check for actual time overlap
        const hasOverlap = overlappingReservations.some((existing) => {
          const existingStart = existing.start_time;
          const existingEnd = existing.end_time;
          const newStart = reservation.start_time;
          const newEnd = reservation.end_time;

          // Check if times overlap
          return (
            (newStart >= existingStart && newStart < existingEnd) ||
            (newEnd > existingStart && newEnd <= existingEnd) ||
            (newStart <= existingStart && newEnd >= existingEnd)
          );
        });

        if (hasOverlap) {
          setIsOverlapping(true);
          const conflictingReservation = overlappingReservations[0];
          setOverlapMessage(
            `This booking conflicts with an existing reservation by ${conflictingReservation.guest_name} from ${conflictingReservation.start_time} to ${conflictingReservation.end_time}.`
          );
        } else {
          setIsOverlapping(false);
        }
      } else {
        setIsOverlapping(false);
      }
    } catch (error) {
      console.error('Error checking for overlaps:', error);
      setIsOverlapping(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 200); // Wait for animation
  };

  const handleAcceptReservation = async () => {
    if (!reservation || isOverlapping) return;

    setIsAccepting(true);
    try {
      const { error } = await supabase
        .from('table_reservations')
        .update({ status: 'confirmed' })
        .eq('id', reservation.id);

      if (error) throw error;

      toast({
        title: 'Reservation Confirmed',
        description: `Successfully confirmed reservation for ${reservation.guest_name}`,
      });

      handleClose();
    } catch (error) {
      console.error('Error accepting reservation:', error);
      toast({
        title: 'Error',
        description: 'Failed to confirm reservation',
        variant: 'destructive',
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const handleViewReservations = () => {
    handleClose();
    navigate('/admin/reservations');
  };

  if (!reservation) return null;

  const formattedDate = new Date(reservation.reservation_date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            🔔 New Reservation
          </DialogTitle>
          <DialogDescription>
            A new table reservation has been submitted
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Users className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="font-semibold">{reservation.guest_name}</p>
              <p className="text-sm text-muted-foreground">Party of {reservation.party_size}</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full">
              <TableProperties className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Table {tableName}</span>
            </div>
          </div>

          {isOverlapping && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {overlapMessage}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{formattedDate}</span>
            </div>
            
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{reservation.start_time} - {reservation.end_time}</span>
            </div>
            
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{reservation.guest_email}</span>
            </div>
            
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{reservation.guest_phone}</span>
            </div>

            {reservation.special_requests && (
              <div className="flex items-start gap-3 mt-3 p-3 bg-muted/50 rounded">
                <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Special Requests:</p>
                  <p className="text-sm">{reservation.special_requests}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Floor Plan Mini Map */}
        <ReservationMiniMap
          branchId={reservation.branch_id}
          highlightTableId={reservation.table_object_id}
          reservationDate={reservation.reservation_date}
          startTime={reservation.start_time}
          endTime={reservation.end_time}
        />

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleClose}>
            Dismiss
          </Button>
          <Button 
            onClick={handleAcceptReservation} 
            disabled={isOverlapping || isAccepting}
            className="flex-1"
          >
            {isAccepting ? (
              'Accepting...'
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Accept Reservation
              </>
            )}
          </Button>
          <Button onClick={handleViewReservations} variant="secondary">
            View All
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
