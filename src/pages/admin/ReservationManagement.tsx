import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Clock, Users, Mail, Phone, Check, X, CalendarIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PauseBranchButton } from '@/components/PauseBranchButton';
import type { DateRange } from 'react-day-picker';

export default function ReservationManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedMonth, setSelectedMonth] = useState<Date>();
  const [filterMode, setFilterMode] = useState<'all' | 'day' | 'month'>('all');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Real-time subscription for reservations
  useEffect(() => {
    const channel = supabase
      .channel('admin-reservations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'table_reservations' },
        (payload) => {
          // Debounce to avoid spamming refreshes
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['admin-reservations'] });

            if (payload.eventType === 'INSERT') {
              toast({
                title: '🔔 New Reservation!',
                description: `New reservation from ${(payload.new as any)?.guest_name || 'a guest'}`,
              });
            }
          }, 250);
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [queryClient, toast]);

  const { data: reservations, isLoading } = useQuery({
    queryKey: ['admin-reservations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('table_reservations')
        .select(`
          *,
          branches (name, city)
        `)
        .order('reservation_date', { ascending: true })
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, admin_notes }: { id: string; status: string; admin_notes?: string }) => {
      const updateData: any = { status };
      if (admin_notes !== undefined) updateData.admin_notes = admin_notes;
      const { error } = await supabase
        .from('table_reservations')
        .update(updateData)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reservations'] });
      toast({ title: 'Reservation updated successfully' });
      setRejectDialogOpen(false);
      setRejectingId(null);
      setRejectionReason('');
    },
  });

  // ── Reservation status → color-group mapping ──
  type ResStatusGroup = 'in_progress' | 'completed' | 'failed';

  const getResStatusGroup = (status: string, reservation?: any): ResStatusGroup => {
    if (['completed', 'archived'].includes(status)) return 'completed';
    if (['cancelled', 'rejected', 'no_show'].includes(status)) return 'failed';
    // Confirmed but reservation time hasn't passed yet → still in progress (yellow)
    if (status === 'confirmed' && reservation) {
      const now = new Date();
      const resDate = new Date(reservation.reservation_date + 'T' + reservation.end_time);
      if (resDate > now) return 'in_progress'; // guests haven't come yet
      return 'completed'; // time has passed
    }
    return 'in_progress';
  };

  const resBadgeStyles: Record<ResStatusGroup, string> = {
    in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const resCardStyles: Record<ResStatusGroup, string> = {
    in_progress: 'border-l-2 border-l-yellow-500 bg-yellow-500/5',
    completed: 'border-l-2 border-l-green-500 bg-green-500/5',
    failed: 'border-l-2 border-l-red-500 bg-red-500/5',
  };

  const resStatusLabels: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    rejected: 'Rejected',
    no_show: 'No Show',
    awaiting_arrangement: 'Needs Table Setup',
  };

  const getStatusBadge = (status: string, reservation?: any) => {
    const group = getResStatusGroup(status, reservation);
    return <Badge className={cn('border', resBadgeStyles[group])}>{resStatusLabels[status] || status}</Badge>;
  };

  // Filter reservations based on selected date and mode
  const filterReservationsByDate = (reservations: any[]) => {
    if (filterMode === 'all') return reservations;

    return reservations.filter((r) => {
      const reservationDate = new Date(r.reservation_date);
      
      if (filterMode === 'day' && dateRange) {
        if (dateRange.from && dateRange.to) {
          // Range selected - normalize dates to compare only date parts
          const fromDate = new Date(dateRange.from);
          fromDate.setHours(0, 0, 0, 0);
          const toDate = new Date(dateRange.to);
          toDate.setHours(23, 59, 59, 999);
          const checkDate = new Date(reservationDate);
          checkDate.setHours(0, 0, 0, 0);
          return checkDate >= fromDate && checkDate <= toDate;
        } else if (dateRange.from) {
          // Single date selected
          return format(reservationDate, 'yyyy-MM-dd') === format(dateRange.from, 'yyyy-MM-dd');
        }
      } else if (filterMode === 'month' && selectedMonth) {
        const monthStart = startOfMonth(selectedMonth);
        const monthEnd = endOfMonth(selectedMonth);
        monthStart.setHours(0, 0, 0, 0);
        monthEnd.setHours(23, 59, 59, 999);
        return reservationDate >= monthStart && reservationDate <= monthEnd;
      }
      return true;
    });
  };

  const filteredReservations = filterReservationsByDate(reservations || []);

  const pendingReservations = filteredReservations?.filter(
    (r) => r.status === 'pending' || r.status === 'awaiting_arrangement'
  ) || [];

  const confirmedReservations = filteredReservations?.filter(
    (r) => r.status === 'confirmed' && new Date(r.reservation_date) >= new Date()
  ) || [];

  const archivedReservations = filteredReservations?.filter((r) => {
    const reservationDate = new Date(r.reservation_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return reservationDate < today;
  }) || [];

  // Group confirmed reservations by date
  const groupedByDate = confirmedReservations.reduce((acc, reservation) => {
    const date = reservation.reservation_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(reservation);
    return acc;
  }, {} as Record<string, typeof confirmedReservations>);

  const ReservationCard = ({ reservation }: { reservation: any }) => {
    const resGroup = getResStatusGroup(reservation.status, reservation);
    return (
    <Card key={reservation.id} className={cn("overflow-hidden", resCardStyles[resGroup])}>
      <CardHeader className="p-3 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-0">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base sm:text-lg break-words">
              {reservation.guest_name}
              {reservation.requires_table_combination && (
                <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-700 border-amber-300 text-xs">
                  Large Party
                </Badge>
              )}
            </CardTitle>
            <p className="text-xs sm:text-sm text-muted-foreground break-words">
              {reservation.branches?.name} - {reservation.branches?.city}
            </p>
          </div>
          <div className="flex-shrink-0">{getStatusBadge(reservation.status, reservation)}</div>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
              <span className="break-words">{format(new Date(reservation.reservation_date), 'PPP')}</span>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
              <span>{reservation.start_time} - {reservation.end_time}</span>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Users className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
              <span>{reservation.party_size} guests</span>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold">
              <span className="text-primary break-all">Table: {reservation.table_object_id}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Mail className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
              <span className="break-all">{reservation.guest_email}</span>
            </div>
            {reservation.guest_phone && (
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <Phone className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                <span>{reservation.guest_phone}</span>
              </div>
            )}
            {reservation.special_requests && (
              <p className="text-xs sm:text-sm text-muted-foreground break-words">
                Note: {reservation.special_requests}
              </p>
            )}
          </div>
        </div>
        
        {reservation.requires_table_combination && reservation.status === 'awaiting_arrangement' && (
          <div className="bg-amber-50 dark:bg-amber-950 p-2 sm:p-3 rounded-lg border border-amber-200 dark:border-amber-800 mt-3 sm:mt-4">
            <p className="text-xs sm:text-sm font-medium text-amber-800 dark:text-amber-200 mb-1 sm:mb-2 break-words">
              ⚠️ This reservation requires multiple tables to be arranged
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 break-words">
              Please arrange tables in the layout designer and confirm the reservation once ready.
            </p>
          </div>
        )}
        
        {(reservation.status === 'pending' || reservation.status === 'awaiting_arrangement') && (
          <div className="flex flex-col sm:flex-row gap-2 mt-3 sm:mt-4">
            <Button
              size="sm"
              disabled={updateStatusMutation.isPending}
              onClick={() => updateStatusMutation.mutate({ id: reservation.id, status: 'confirmed' })}
              className="w-full sm:w-auto text-xs sm:text-sm"
            >
              <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              Confirm
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={updateStatusMutation.isPending}
              onClick={() => {
                setRejectingId(reservation.id);
                setRejectionReason('');
                setRejectDialogOpen(true);
              }}
              className="w-full sm:w-auto text-xs sm:text-sm"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
  };

  const getFilterLabel = () => {
    if (filterMode === 'day' && dateRange) {
      if (dateRange.from && dateRange.to) {
        return `${format(dateRange.from, 'PP')} - ${format(dateRange.to, 'PP')}`;
      } else if (dateRange.from) {
        return format(dateRange.from, 'PP');
      }
    } else if (filterMode === 'month' && selectedMonth) {
      return format(selectedMonth, 'MMMM yyyy');
    }
    return null;
  };

  return (
    <>
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6 overflow-x-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="w-full sm:w-auto">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold">Reservation Management</h1>
              <PauseBranchButton mode="reservations" />
            </div>
            <p className="text-sm sm:text-base text-muted-foreground">Manage table reservations across all branches</p>
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button
              variant={filterMode === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setFilterMode('all');
                setDateRange(undefined);
                setSelectedMonth(undefined);
              }}
              className="flex-1 sm:flex-initial min-w-[80px]"
            >
              All
            </Button>
            
            <Popover open={isDatePickerOpen && filterMode === 'day'} onOpenChange={(open) => {
              setIsDatePickerOpen(open);
              if (!open && filterMode === 'day' && !dateRange) {
                setFilterMode('all');
              }
            }}>
              <PopoverTrigger asChild>
                <Button
                  variant={filterMode === 'day' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setFilterMode('day');
                    setSelectedMonth(undefined);
                    setIsDatePickerOpen(true);
                  }}
                  className="flex-1 sm:flex-initial min-w-[80px]"
                >
                  <CalendarIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate text-xs sm:text-sm">
                    {filterMode === 'day' && getFilterLabel() 
                      ? getFilterLabel()
                      : 'Day'}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => {
                    setDateRange(range);
                  }}
                  onClear={() => {
                    setDateRange(undefined);
                    setFilterMode('all');
                    setIsDatePickerOpen(false);
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            <Popover open={isDatePickerOpen && filterMode === 'month'} onOpenChange={(open) => {
              setIsDatePickerOpen(open);
              if (!open && filterMode === 'month' && !selectedMonth) {
                setFilterMode('all');
              }
            }}>
              <PopoverTrigger asChild>
                <Button
                  variant={filterMode === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setFilterMode('month');
                    setDateRange(undefined);
                    setIsDatePickerOpen(true);
                  }}
                  className="flex-1 sm:flex-initial min-w-[80px]"
                >
                  <CalendarIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate text-xs sm:text-sm">
                    {filterMode === 'month' && getFilterLabel() 
                      ? getFilterLabel()
                      : 'Month'}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="single"
                  selected={selectedMonth}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedMonth(date);
                      setFilterMode('month');
                      setIsDatePickerOpen(false);
                    }
                  }}
                  onClear={() => {
                    setSelectedMonth(undefined);
                    setFilterMode('all');
                    setIsDatePickerOpen(false);
                  }}
                  showClearButton={false}
                  defaultMonth={selectedMonth || new Date()}
                  month={selectedMonth || new Date()}
                  onMonthChange={(date) => {
                    setSelectedMonth(date);
                    setFilterMode('month');
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                  classNames={{
                    months: "flex flex-col",
                    month: "space-y-4",
                    caption: "flex justify-between pt-1 relative items-center px-8",
                    caption_label: "text-sm font-medium cursor-pointer",
                    nav: "flex items-center gap-1",
                    nav_button_previous: "absolute left-1",
                    nav_button_next: "absolute right-1",
                    table: "hidden",
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading reservations...</div>
        ) : (
          <Tabs defaultValue="pending" className="w-full">
            <TabsList>
              <TabsTrigger value="pending">
                Pending ({pendingReservations.length})
              </TabsTrigger>
              <TabsTrigger value="confirmed">
                Confirmed ({confirmedReservations.length})
              </TabsTrigger>
              <TabsTrigger value="archive">
                Archive ({archivedReservations.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4 mt-6">
              {pendingReservations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No pending reservations
                </div>
              ) : (
                pendingReservations.map((reservation) => (
                  <ReservationCard key={reservation.id} reservation={reservation} />
                ))
              )}
            </TabsContent>

            <TabsContent value="archive" className="space-y-6 mt-6">
              {archivedReservations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No archived reservations
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Archived reservations are automatically deleted after 3 months
                    </p>
                  </div>
                  {Object.entries(
                    archivedReservations.reduce((acc, reservation) => {
                      const date = reservation.reservation_date;
                      if (!acc[date]) {
                        acc[date] = [];
                      }
                      acc[date].push(reservation);
                      return acc;
                    }, {} as Record<string, typeof archivedReservations>)
                  )
                    .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
                    .map(([date, dateReservations]) => (
                      <div key={date} className="space-y-4">
                        <h3 className="text-xl font-semibold sticky top-0 bg-background py-2 border-b">
                          {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                        </h3>
                        <div className="grid gap-4">
                          {(dateReservations as any[])
                            .sort((a, b) => a.start_time.localeCompare(b.start_time))
                            .map((reservation) => (
                              <ReservationCard key={reservation.id} reservation={reservation} />
                            ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="confirmed" className="space-y-6 mt-6">
              {Object.keys(groupedByDate).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No confirmed reservations
                </div>
              ) : (
                Object.entries(groupedByDate)
                  .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
                  .map(([date, dateReservations]) => (
                    <div key={date} className="space-y-4">
                      <h3 className="text-xl font-semibold sticky top-0 bg-background py-2 border-b">
                        {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                      </h3>
                      <div className="grid gap-4">
                        {(dateReservations as any[])
                          .sort((a, b) => a.start_time.localeCompare(b.start_time))
                          .map((reservation) => (
                            <ReservationCard key={reservation.id} reservation={reservation} />
                          ))}
                      </div>
                    </div>
                  ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AdminLayout>

    <Dialog open={rejectDialogOpen} onOpenChange={(open) => {
      setRejectDialogOpen(open);
      if (!open) { setRejectingId(null); setRejectionReason(''); }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Reservation</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">Optionally provide a reason for the rejection. This will be shown to the customer.</p>
          <Textarea
            placeholder="Reason for rejection (optional)"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={updateStatusMutation.isPending}
            onClick={() => {
              if (rejectingId) {
                updateStatusMutation.mutate({
                  id: rejectingId,
                  status: 'rejected',
                  admin_notes: rejectionReason.trim() || undefined,
                });
              }
            }}
          >
            Reject Reservation
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
