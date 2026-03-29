import { useState, useEffect, useCallback } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStaffBranch } from '@/contexts/StaffBranchContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { Calendar, Clock, Users, Mail, Phone, Check, X, MapPin, MessageSquareText, UtensilsCrossed, TableProperties } from 'lucide-react';
import { toast } from 'sonner';
import { playReservationAlert } from '@/lib/notificationSound';
import { ReservationMiniMap } from '@/components/reservation/ReservationMiniMap';

export const NewReservationPopup = () => {
  const queryClient = useQueryClient();
  const [reservation, setReservation] = useState<any | null>(null);
  const { selectedBranchId: staffBranchId } = useStaffBranch();
  const [tableName, setTableName] = useState<string>('');

  const fetchReservationDetails = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('table_reservations')
        .select('*, branches(name, city, address)')
        .eq('id', id)
        .single();
      if (error) throw error;
      setReservation(data);
      // Resolve table label from branch layout
      if (data?.branch_id && data?.table_object_id) {
        try {
          const { data: branchData } = await supabase
            .from('branches')
            .select('layout_data')
            .eq('id', data.branch_id)
            .single();
          if (branchData?.layout_data) {
            const layoutData = branchData.layout_data as any;
            const table = layoutData.objects?.find((obj: any) => obj.id === data.table_object_id);
            setTableName(table?.label || data.table_object_id);
          } else {
            setTableName(data.table_object_id);
          }
        } catch {
          setTableName(data.table_object_id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch reservation details:', err);
    }
  }, []);

  // Real-time subscription for new reservations
  useEffect(() => {
    const channel = supabase
      .channel('staff-global-new-reservation-popup')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'table_reservations' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['staff-reservations'] });
        if (staffBranchId && (payload.new as any)?.branch_id === staffBranchId) {
          playReservationAlert();
          toast.success('New reservation request!', {
            description: `From ${(payload.new as any)?.guest_name || 'a guest'}`,
          });
          fetchReservationDetails((payload.new as any).id);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, fetchReservationDetails, staffBranchId]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('table_reservations').update({ status }).eq('id', id);
      if (error) throw error;

      // Send reservation status email
      if (['confirmed', 'cancelled'].includes(status)) {
        const emailStatus = status === 'confirmed' ? 'approved' : 'cancelled';
        supabase.functions.invoke('send-reservation-email', { body: { reservation_id: id, new_status: emailStatus } })
          .then(({ error: emailErr }) => {
            if (emailErr) console.error('Reservation email error:', emailErr);
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-reservations'] });
      toast.success('Reservation updated');
      setReservation(null);
    },
  });

  return (
    <Dialog open={!!reservation} onOpenChange={(open) => !open && setReservation(null)}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <TableProperties className="w-5 h-5 text-primary" />
            New Reservation
            {reservation?.status && (
              <Badge variant="secondary" className="ml-2 text-xs capitalize">
                {reservation.status === 'pending' ? 'New' : reservation.status}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {reservation && (
          <div className="space-y-4">
            {/* Guest Info */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Guest Details
              </h3>
              <div className="grid gap-1.5 text-sm">
                <p className="font-medium">{reservation.guest_name || 'Guest'}</p>
                {reservation.guest_email && (
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" />
                    {reservation.guest_email}
                  </p>
                )}
                {reservation.guest_phone && (
                  <a href={`tel:${reservation.guest_phone}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary">
                    <Phone className="w-3.5 h-3.5" />
                    {reservation.guest_phone}
                  </a>
                )}
              </div>
            </div>

            {/* Reservation Info */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-primary" /> Reservation Info
              </h3>
              <div className="grid gap-1.5 text-sm">
                <p className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {format(new Date(reservation.reservation_date), 'PPP')}
                </p>
                <p className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  {reservation.start_time} – {reservation.end_time}
                </p>
                <p className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  {reservation.party_size} guests
                </p>
                {reservation.branches?.name && (
                  <p className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    {reservation.branches.name} — {reservation.branches.city}
                  </p>
                )}
                <p className="text-xs font-semibold text-primary flex items-center gap-1">
                  <TableProperties className="w-3.5 h-3.5" />
                  Table: {tableName || reservation.table_object_id}
                </p>
                {reservation.requires_table_combination && (
                  <Badge variant="outline" className="w-fit bg-amber-50 text-amber-700 border-amber-300 text-xs dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700">
                    Large Party — Requires Table Combination
                  </Badge>
                )}
              </div>
            </div>

            {/* Special Requests */}
            {reservation.special_requests && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs font-medium text-primary mb-1 flex items-center gap-1">
                  <MessageSquareText className="w-3.5 h-3.5" /> Special Requests
                </p>
                <p className="text-sm">{reservation.special_requests}</p>
              </div>
            )}

            {/* Floor Plan Mini Map */}
            {reservation.branch_id && reservation.table_object_id && reservation.reservation_date && (
              <ReservationMiniMap
                branchId={reservation.branch_id}
                highlightTableId={reservation.table_object_id}
                reservationDate={reservation.reservation_date}
                startTime={reservation.start_time}
                endTime={reservation.end_time}
              />
            )}
          </div>
        )}

        {reservation?.status === 'pending' && (
          <DialogFooter className="flex gap-2 sm:gap-2 pt-2">
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => updateStatusMutation.mutate({ id: reservation.id, status: 'cancelled' })}
              disabled={updateStatusMutation.isPending}
            >
              <X className="w-4 h-4 mr-1" /> Reject
            </Button>
            <Button
              className="flex-1"
              onClick={() => updateStatusMutation.mutate({ id: reservation.id, status: 'confirmed' })}
              disabled={updateStatusMutation.isPending}
            >
              <Check className="w-4 h-4 mr-1" /> Confirm
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
