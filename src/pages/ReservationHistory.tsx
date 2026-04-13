import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, Users, CalendarDays, Phone, ExternalLink, X, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/BackButton";
import LoadingScreen from "@/components/LoadingScreen";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getGuestReservations } from "@/lib/guestReservations";
import { ReservationDetailSheet } from "@/components/reservation/ReservationDetailSheet";

interface Reservation {
  id: string;
  branch_id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  party_size: number;
  status: string;
  special_requests: string | null;
  created_at: string;
  branch_name?: string;
  branch_phone?: string;
  branch_address?: string;
  branch_latitude?: number;
  branch_longitude?: number;
  isGuest?: boolean;
}

const ReservationHistory = () => {
  const { user: authUser, isAuthReady } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!isAuthReady) return;
    fetchReservations();
  }, [isAuthReady, authUser?.id]);

  const mapReservation = (r: any, isGuest = false): Reservation => ({
    ...r,
    branch_name: r.branches?.name || 'Unknown Branch',
    branch_phone: r.branches?.phone || '',
    branch_address: r.branches?.address || '',
    branch_latitude: r.branches?.latitude ? Number(r.branches.latitude) : undefined,
    branch_longitude: r.branches?.longitude ? Number(r.branches.longitude) : undefined,
    isGuest,
  });

  const fetchReservations = async () => {
    try {
      const user = authUser;
      if (user) {
        const { data, error } = await supabase
          .from("table_reservations")
          .select("*, branches(name, phone, address, latitude, longitude)")
          .eq('user_id', user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setReservations((data || []).map(r => mapReservation(r)));
      } else {
        const guestEntries = getGuestReservations();
        if (guestEntries.length === 0) {
          setReservations([]);
          setLoading(false);
          return;
        }

        const results = await Promise.allSettled(
          guestEntries.map(entry =>
            supabase.functions.invoke('get-guest-reservation', {
              body: { reservation_id: entry.id, email: entry.email },
            })
          )
        );

        const fetched: Reservation[] = [];
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.data?.reservation) {
            const r = result.value.data.reservation;
            fetched.push(mapReservation(r, true));
          }
        }

        fetched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setReservations(fetched);
      }
    } catch (error) {
      console.error("Error fetching reservations:", error);
      toast.error("Failed to load reservations");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelReservation = async (reservation: Reservation) => {
    setCancellingId(reservation.id);
    try {
      if (reservation.isGuest) {
        const guestEntries = getGuestReservations();
        const entry = guestEntries.find(e => e.id === reservation.id);
        if (!entry) throw new Error('Guest reservation not found');

        const { data, error } = await supabase.functions.invoke('cancel-guest-reservation', {
          body: { reservation_id: reservation.id, email: entry.email },
        });
        if (error || data?.error) throw new Error(data?.error || 'Failed to cancel');
      } else {
        const { error } = await supabase
          .from('table_reservations')
          .update({ status: 'cancelled' })
          .eq('id', reservation.id);
        if (error) throw error;
      }

      setReservations(prev =>
        prev.map(r => r.id === reservation.id ? { ...r, status: 'cancelled' } : r)
      );
      toast.success('Reservation cancelled successfully');
    } catch (error) {
      console.error('Error cancelling reservation:', error);
      toast.error('Failed to cancel reservation');
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500",
      confirmed: "bg-green-500",
      cancelled: "bg-red-500",
      no_show: "bg-red-400",
      completed: "bg-green-600",
      rejected: "bg-red-600",
    };
    return colors[status] || "bg-muted";
  };

  const formatStatus = (status: string) =>
    status.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  const formatTime = (time: string) => {
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  const handleCardClick = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setSheetOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-8 pt-safe">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="mb-6"><BackButton /></div>
          <div className="mb-8">
            <div className="h-8 w-56 bg-muted animate-pulse rounded mb-2" />
            <div className="h-4 w-72 bg-muted animate-pulse rounded" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i}><CardContent className="p-4"><div className="h-20 bg-muted animate-pulse rounded" /></CardContent></Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8 pt-safe">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <BackButton />
        </div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Reservation History</h1>
          <p className="text-muted-foreground">Your past and upcoming reservations</p>
        </div>

        {reservations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-1">No reservations yet</p>
              <p className="text-sm text-muted-foreground">
                Book a table to see your reservations here
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {reservations.map((reservation) => {
              const now = new Date();
              const endDateTime = new Date(`${reservation.reservation_date}T${reservation.end_time}`);
              const hasEnded = now > endDateTime;
              const isUpcoming = ['pending', 'confirmed'].includes(reservation.status) && !hasEnded;
              const isVisited = reservation.status === 'confirmed' && hasEnded;
              const reservationDate = new Date(reservation.reservation_date + 'T00:00:00');

              const statusLabel = isVisited ? 'Visited' : formatStatus(reservation.status);
              const statusColor = isVisited
                ? 'bg-green-600'
                : reservation.status === 'confirmed' && !hasEnded
                  ? 'bg-blue-500'
                  : getStatusColor(reservation.status);

              return (
                <Card
                  key={reservation.id}
                  className="transition-all hover:shadow-lg cursor-pointer active:scale-[0.98]"
                  onClick={() => handleCardClick(reservation)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{reservation.branch_name}</p>
                          {isUpcoming && (
                            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                              Upcoming
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <CalendarDays className="h-3 w-3" />
                          {reservationDate.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <Badge className={`${statusColor} text-white`}>
                        {statusLabel}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{formatTime(reservation.start_time)} – {formatTime(reservation.end_time)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>{reservation.party_size} {reservation.party_size === 1 ? 'guest' : 'guests'}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>

                    {/* Cancel button for pending upcoming reservations */}
                    {isUpcoming && reservation.status === 'pending' && (
                      <div className="mt-4 border-t border-border pt-4" onClick={(e) => e.stopPropagation()}>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                              disabled={cancellingId === reservation.id}
                            >
                              <X className="h-4 w-4 mr-2" />
                              {cancellingId === reservation.id ? 'Cancelling...' : 'Cancel Reservation'}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel Reservation?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to cancel your reservation at {reservation.branch_name} on{' '}
                                {new Date(reservation.reservation_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                {' '}at {formatTime(reservation.start_time)}? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep Reservation</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleCancelReservation(reservation)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Yes, Cancel
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <ReservationDetailSheet
        reservation={selectedReservation ? {
          id: selectedReservation.id,
          branch_name: selectedReservation.branch_name || '',
          branch_phone: selectedReservation.branch_phone || '',
          branch_address: selectedReservation.branch_address || '',
          branch_latitude: selectedReservation.branch_latitude,
          branch_longitude: selectedReservation.branch_longitude,
          reservation_date: selectedReservation.reservation_date,
          start_time: selectedReservation.start_time,
          end_time: selectedReservation.end_time,
          party_size: selectedReservation.party_size,
          status: selectedReservation.status,
          special_requests: selectedReservation.special_requests,
          created_at: selectedReservation.created_at,
        } : null}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
};

export default ReservationHistory;
