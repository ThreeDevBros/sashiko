import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppLifecycle } from '@/hooks/useAppLifecycle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StaffLayout } from '@/components/staff/StaffLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Clock, Users, Mail, Phone, Check, X, ZoomIn, ZoomOut, Crosshair, ChevronLeft, ChevronRight, Layers, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { PauseBranchButton } from '@/components/PauseBranchButton';
import { FloorPlanCanvas, type LayoutObject, type TableAvailabilityStatus } from '@/components/reservation/FloorPlanCanvas';

interface FloorData {
  id: string;
  name: string;
  objects: LayoutObject[];
}

const CANVAS_W = 1600;
const CANVAS_H = 1600;
const MAX_ZOOM = 3;
const BOUNDARY_PADDING = 60;
const ACTIVE_RESERVATION_STATUSES = ['pending', 'awaiting_arrangement', 'confirmed'];

function computeBounds(objects: LayoutObject[]) {
  if (objects.length === 0) return { minX: 0, minY: 0, maxX: CANVAS_W, maxY: CANVAS_H };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  objects.forEach((obj) => {
    minX = Math.min(minX, obj.x - BOUNDARY_PADDING);
    minY = Math.min(minY, obj.y - BOUNDARY_PADDING);
    maxX = Math.max(maxX, obj.x + obj.width + BOUNDARY_PADDING);
    maxY = Math.max(maxY, obj.y + obj.height + BOUNDARY_PADDING);
  });

  return { minX, minY, maxX, maxY };
}

function computeMinZoom(bounds: ReturnType<typeof computeBounds>, vpW: number, vpH: number) {
  const contentW = bounds.maxX - bounds.minX;
  const contentH = bounds.maxY - bounds.minY;
  if (contentW <= 0 || contentH <= 0) return 0.2;
  return Math.min(vpW / contentW, vpH / contentH) * 0.9;
}

function roundToNearestHour(date: Date) {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  rounded.setMinutes(0, 0, 0);
  if (minutes >= 30) rounded.setHours(rounded.getHours() + 1);
  return `${String(rounded.getHours()).padStart(2, '0')}:00`;
}

function buildHalfHourOptions() {
  return Array.from({ length: 48 }, (_, index) => {
    const hours = Math.floor(index / 2);
    const minutes = index % 2 === 0 ? '00' : '30';
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  });
}

function normalizeLayoutData(layoutData: any): FloorData[] {
  if (!layoutData) return [];

  if (Array.isArray(layoutData.floors)) {
    return layoutData.floors.map((floor: any, index: number) => ({
      id: floor.id || `floor-${index + 1}`,
      name: floor.name || `Floor ${index + 1}`,
      objects: (floor.objects || []).map((obj: any) => ({
        ...obj,
        type: obj.type === 'toilet' ? 'wc' : obj.type,
      })),
    }));
  }

  if (Array.isArray(layoutData.objects)) {
    return [{
      id: 'floor-1',
      name: 'Main Floor',
      objects: layoutData.objects.map((obj: any) => ({
        ...obj,
        type: obj.type === 'toilet' ? 'wc' : obj.type,
      })),
    }];
  }

  return [];
}

function combineDateAndTime(dateStr: string, timeStr: string) {
  return new Date(`${dateStr}T${timeStr}`);
}

export default function StaffReservations() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const hasFittedRef = useRef(false);

  // Resume counter to force realtime reconnect after backgrounding
  const [resumeCounter, setResumeCounter] = useState(0);
  useAppLifecycle(() => {
    setResumeCounter(prev => prev + 1);
  });

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>(() => roundToNearestHour(new Date()));
  const [selectedReservation, setSelectedReservation] = useState<any | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);
  const [activeFloorId, setActiveFloorId] = useState<string>('');
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [viewMode, setViewMode] = useState<'overview' | 'time-filtered'>('overview');

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const timeOptions = useMemo(() => buildHalfHourOptions(), []);

  const { data: branchContext, isLoading: branchLoading } = useQuery({
    queryKey: ['staff-reservations-branch-context'],
    queryFn: async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) return null;

      const { data: assignment, error: assignmentError } = await supabase
        .from('staff_branches')
        .select('branch_id')
        .eq('user_id', authData.user.id)
        .limit(1)
        .maybeSingle();

      if (assignmentError) throw assignmentError;
      if (!assignment?.branch_id) return null;

      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id, name, layout_data')
        .eq('id', assignment.branch_id)
        .single();

      if (branchError) throw branchError;

      return {
        branchId: branch.id,
        branchName: branch.name,
        layoutData: branch.layout_data,
      };
    },
  });

  useEffect(() => {
    if (!branchLoading) {
      setLoadTimedOut(false);
      return;
    }

    setLoadTimedOut(false);
    const timeoutId = window.setTimeout(() => setLoadTimedOut(true), 8000);
    return () => window.clearTimeout(timeoutId);
  }, [branchLoading]);

  useEffect(() => {
    if (!branchContext?.branchId) return;

    const channel = supabase
      .channel(`staff-reservations-${branchContext.branchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_reservations' }, (payload) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['staff-reservations-for-date', branchContext.branchId] });

          if (payload.eventType === 'INSERT' && (payload.new as any)?.branch_id === branchContext.branchId) {
            toast.success('New reservation!', {
              description: `From ${(payload.new as any)?.guest_name || 'a guest'}`,
            });
          }
        }, 250);
      })
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [branchContext?.branchId, queryClient]);

  const { data: reservations = [] } = useQuery({
    queryKey: ['staff-reservations-for-date', branchContext?.branchId, dateStr],
    queryFn: async () => {
      if (!branchContext?.branchId) return [];

      const { data, error } = await supabase
        .from('table_reservations')
        .select('*')
        .eq('branch_id', branchContext.branchId)
        .eq('reservation_date', dateStr)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!branchContext?.branchId,
  });

  const floors = useMemo(() => normalizeLayoutData(branchContext?.layoutData), [branchContext?.layoutData]);

  useEffect(() => {
    if (floors.length > 0 && !activeFloorId) {
      setActiveFloorId(floors[0].id);
    }
  }, [floors, activeFloorId]);

  const activeFloor = floors.find((floor) => floor.id === activeFloorId) || floors[0];
  const currentObjects = activeFloor?.objects || [];
  const bounds = useMemo(() => computeBounds(currentObjects), [currentObjects]);

  const tableLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    floors.forEach((floor) => {
      floor.objects.forEach((obj) => {
        if (obj.type === 'table') {
          map.set(obj.id, obj.label || obj.id);
        }
      });
    });
    return map;
  }, [floors]);

  const selectedTimeWithSeconds = `${selectedTime}:00`;
  const activeReservationsAtTime = useMemo(() => (
    reservations.filter((reservation: any) => (
      ACTIVE_RESERVATION_STATUSES.includes(reservation.status) &&
      reservation.start_time <= selectedTimeWithSeconds &&
      reservation.end_time > selectedTimeWithSeconds
    ))
  ), [reservations, selectedTimeWithSeconds]);

  const reservationsByTable = useMemo(() => {
    const map = new Map<string, any[]>();
    activeReservationsAtTime.forEach((reservation: any) => {
      const existing = map.get(reservation.table_object_id) || [];
      existing.push(reservation);
      map.set(reservation.table_object_id, existing);
    });
    return map;
  }, [activeReservationsAtTime]);

  const tableStatesOverride = useMemo(() => {
    const states: Partial<Record<string, TableAvailabilityStatus>> = {};
    currentObjects.forEach((obj) => {
      if (obj.type !== 'table') return;
      if (reservationsByTable.has(obj.id)) {
        states[obj.id] = 'reserved';
      } else if (!obj.seats || obj.seats <= 0) {
        states[obj.id] = 'unavailable';
      } else {
        states[obj.id] = 'available';
      }
    });
    return states;
  }, [currentObjects, reservationsByTable]);

  const fitToView = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const vpW = vp.clientWidth;
    const vpH = vp.clientHeight;
    const fitZoom = computeMinZoom(bounds, vpW, vpH);
    const clampedZoom = Math.max(0.15, Math.min(MAX_ZOOM, fitZoom));
    const contentW = bounds.maxX - bounds.minX;
    const contentH = bounds.maxY - bounds.minY;

    setZoom(clampedZoom);
    setPan({
      x: (vpW - contentW * clampedZoom) / 2 - bounds.minX * clampedZoom,
      y: (vpH - contentH * clampedZoom) / 2 - bounds.minY * clampedZoom,
    });
  }, [bounds]);

  useEffect(() => {
    if (currentObjects.length > 0 && !hasFittedRef.current) {
      hasFittedRef.current = true;
      window.setTimeout(fitToView, 100);
    }
  }, [currentObjects, fitToView]);

  const handleFloorChange = (floorId: string) => {
    setActiveFloorId(floorId);
    hasFittedRef.current = false;
  };

  const handleTableClick = (table: LayoutObject) => {
    const tableReservations = reservationsByTable.get(table.id);
    if (!tableReservations?.length) return;

    setSelectedReservation({
      ...tableReservations[0],
      _allReservations: tableReservations,
      _tableLabel: table.label || tableLabelMap.get(table.id) || table.id,
    });
    setDetailDialogOpen(true);
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, admin_notes }: { id: string; status: string; admin_notes?: string }) => {
      const updateData: any = { status };
      if (admin_notes !== undefined) updateData.admin_notes = admin_notes;
      const { error } = await supabase.from('table_reservations').update(updateData).eq('id', id);
      if (error) throw error;

      if (['confirmed', 'cancelled'].includes(status)) {
        const emailStatus = status === 'confirmed' ? 'approved' : 'cancelled';
        supabase.functions.invoke('send-reservation-email', { body: { reservation_id: id, new_status: emailStatus } })
          .then(({ error: emailErr }) => {
            if (emailErr) console.error('Reservation email error:', emailErr);
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-reservations-for-date'] });
      toast.success('Reservation updated');
      setDetailDialogOpen(false);
      setSelectedReservation(null);
      setRejectDialogOpen(false);
      setRejectingId(null);
      setRejectionReason('');
    },
  });

  const getReservationListStatus = (reservation: any) => {
    const now = new Date();
    const reservationStart = combineDateAndTime(reservation.reservation_date, reservation.start_time);
    const reservationEnd = combineDateAndTime(reservation.reservation_date, reservation.end_time);

    if (reservation.status === 'cancelled') {
      return {
        label: 'Cancelled',
        className: 'border',
        style: {
          backgroundColor: 'hsl(0 62% 22% / 0.18)',
          color: 'hsl(0 72% 68%)',
          borderColor: 'hsl(0 62% 34% / 0.45)',
        },
      };
    }

    if (reservation.status === 'rejected') {
      return {
        label: 'Rejected',
        className: 'border',
        style: {
          backgroundColor: 'hsl(var(--destructive) / 0.16)',
          color: 'hsl(var(--destructive))',
          borderColor: 'hsl(var(--destructive) / 0.35)',
        },
      };
    }

    if (reservation.status === 'completed' || reservation.status === 'no_show' || reservationEnd <= now) {
      return {
        label: 'Finished',
        className: 'border',
        style: {
          backgroundColor: 'hsl(var(--muted) / 0.9)',
          color: 'hsl(var(--muted-foreground))',
          borderColor: 'hsl(var(--border))',
        },
      };
    }

    if (reservation.status === 'confirmed' && reservationStart <= now && reservationEnd > now) {
      return {
        label: 'Currently Seated',
        className: 'border animate-pulse',
        style: {
          backgroundColor: 'hsl(var(--primary) / 0.18)',
          color: 'hsl(var(--primary))',
          borderColor: 'hsl(var(--primary) / 0.42)',
        },
      };
    }

    if (reservation.status === 'confirmed') {
      return {
        label: 'Confirmed',
        className: 'border',
        style: {
          backgroundColor: 'hsl(142 71% 45% / 0.16)',
          color: 'hsl(142 71% 58%)',
          borderColor: 'hsl(142 71% 45% / 0.35)',
        },
      };
    }

    return {
      label: 'Pending',
      className: 'border',
      style: {
        backgroundColor: 'hsl(var(--primary) / 0.16)',
        color: 'hsl(var(--primary))',
        borderColor: 'hsl(var(--primary) / 0.35)',
      },
    };
  };

  const goToPreviousDay = () => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 1);
      return next;
    });
  };

  const goToNextDay = () => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 1);
      return next;
    });
  };

  return (
    <>
      <StaffLayout>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Reservations</h1>
              <p className="text-muted-foreground text-sm">Floor plan view — tap reserved tables for details</p>
            </div>
            <PauseBranchButton branchId={branchContext?.branchId} mode="reservations" />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPreviousDay} className="h-9 w-9">
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('flex-1 justify-start text-left font-medium')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>

            <Button variant="outline" size="icon" onClick={goToNextDay} className="h-9 w-9">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            {viewMode === 'time-filtered' && (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: 'hsl(142 71% 45% / 0.16)', borderColor: 'hsl(142 71% 45% / 0.35)' }} />
                  <span className="text-muted-foreground">Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: 'hsl(var(--destructive) / 0.16)', borderColor: 'hsl(var(--destructive) / 0.35)' }} />
                  <span className="text-muted-foreground">Reserved ({activeReservationsAtTime.length})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: 'hsl(var(--muted) / 0.9)', borderColor: 'hsl(var(--border))' }} />
                  <span className="text-muted-foreground">Unavailable</span>
                </div>
              </>
            )}

            {floors.length > 1 && (
              <Select value={activeFloor?.id} onValueChange={handleFloorChange}>
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <Layers className="w-3.5 h-3.5 mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {floors.map((floor) => (
                    <SelectItem key={floor.id} value={floor.id}>{floor.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="ml-auto flex items-center gap-2">
              {viewMode === 'time-filtered' && (
                <>
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <Select value={selectedTime} onValueChange={setSelectedTime}>
                    <SelectTrigger className="w-[90px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {timeOptions.map((time) => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setViewMode(viewMode === 'overview' ? 'time-filtered' : 'overview')}
              >
                {viewMode === 'overview' ? (
                  <><Clock className="w-3.5 h-3.5 mr-1.5" />View by Time</>
                ) : (
                  <><Eye className="w-3.5 h-3.5 mr-1.5" />Overview</>
                )}
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-0 relative">
              <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
                <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value * 1.2))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => setZoom((value) => Math.max(0.15, value * 0.8))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="icon" className="h-8 w-8" onClick={fitToView}>
                  <Crosshair className="h-4 w-4" />
                </Button>
              </div>

              {loadTimedOut ? (
                <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
                  Could not load branch data. Please refresh.
                </div>
              ) : branchLoading ? (
                <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
                  Loading branch data...
                </div>
              ) : !branchContext?.branchId ? (
                <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
                  No branch assigned. Contact an admin.
                </div>
              ) : currentObjects.length === 0 ? (
                <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
                  No floor plan configured for this branch.
                </div>
              ) : (
                <FloorPlanCanvas
                  viewportRef={viewportRef}
                  zoom={zoom}
                  pan={pan}
                  setZoom={setZoom}
                  setPan={setPan}
                  currentObjects={currentObjects}
                  hoveredTableId={hoveredTableId}
                  setHoveredTableId={setHoveredTableId}
                  handleTableClick={handleTableClick}
                  height="60vh"
                  bounds={bounds}
                  minZoom={computeMinZoom(bounds, viewportRef.current?.clientWidth || 800, viewportRef.current?.clientHeight || 600)}
                  tableStatesOverride={viewMode === 'time-filtered' ? tableStatesOverride : undefined}
                  clickableStatuses={viewMode === 'time-filtered' ? ['reserved'] : ['available', 'reserved', 'unavailable']}
                  showLegend={false}
                  showStatusBadges={viewMode === 'time-filtered'}
                  showStatusRings={viewMode === 'time-filtered'}
                  legendLabels={{
                    available: 'Available',
                    reserved: 'Reserved',
                    unavailable: 'Unavailable',
                  }}
                  statusHints={{
                    available: 'Free at selected time',
                    reserved: 'Tap for reservation details',
                    unavailable: 'Unavailable',
                  }}
                />
              )}
            </CardContent>
          </Card>

          {(() => {
            const displayReservations = viewMode === 'time-filtered'
              ? reservations.filter((r: any) => r.start_time <= selectedTimeWithSeconds && r.end_time > selectedTimeWithSeconds)
              : reservations;
            const listLabel = viewMode === 'time-filtered'
              ? `Reservations at ${selectedTime} on ${format(selectedDate, 'MMM d')}`
              : `Reservations for ${format(selectedDate, 'MMM d')}`;

            return displayReservations.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {listLabel} ({displayReservations.length})
              </h2>
              <div className="grid gap-2">
                {displayReservations.map((reservation: any) => {
                  const status = getReservationListStatus(reservation);
                  const tableName = tableLabelMap.get(reservation.table_object_id) || reservation.table_object_id;

                  return (
                    <button
                      key={reservation.id}
                      className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      onClick={() => {
                        setSelectedReservation({
                          ...reservation,
                          _tableLabel: tableName,
                        });
                        setDetailDialogOpen(true);
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="font-medium text-sm truncate">{reservation.guest_name || 'Guest'}</span>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3 flex-shrink-0" />
                            <span className="font-semibold text-foreground">{reservation.start_time?.slice(0, 5)} – {reservation.end_time?.slice(0, 5)}</span>
                            <span>·</span>
                            <span>{tableName}</span>
                            <span>·</span>
                            <span>{reservation.party_size} guests</span>
                          </div>
                        </div>
                        <Badge className={status.className} style={status.style}>{status.label}</Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No reservations for {viewMode === 'time-filtered' ? 'this time' : 'this day'}
            </div>
          );
          })()}
        </div>

        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg">{selectedReservation?._tableLabel || 'Reservation Details'}</DialogTitle>
            </DialogHeader>

            {selectedReservation && (
              <div className="space-y-4">
                {(selectedReservation._allReservations || [selectedReservation]).map((reservation: any, index: number) => {
                  const status = getReservationListStatus(reservation);
                  return (
                    <div key={reservation.id} className="space-y-3">
                      {index > 0 && <Separator />}

                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-base">{reservation.guest_name || 'Guest'}</span>
                        <Badge className={status.className} style={status.style}>{status.label}</Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span>{format(new Date(reservation.reservation_date), 'PPP')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span>{reservation.start_time} – {reservation.end_time}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span>{reservation.party_size} guests</span>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="break-all">{reservation.guest_email}</span>
                        </div>
                        {reservation.guest_phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span>{reservation.guest_phone}</span>
                          </div>
                        )}
                      </div>

                      {reservation.special_requests && (
                        <div className="p-2.5 rounded-md bg-muted/50 text-xs">
                          <span className="font-medium">Special requests:</span> {reservation.special_requests}
                        </div>
                      )}

                      {(reservation.status === 'pending' || reservation.status === 'awaiting_arrangement') && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            disabled={updateStatusMutation.isPending}
                            onClick={() => updateStatusMutation.mutate({ id: reservation.id, status: 'confirmed' })}
                          >
                            <Check className="w-3.5 h-3.5 mr-1" /> Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1"
                            disabled={updateStatusMutation.isPending}
                            onClick={() => {
                              setRejectingId(reservation.id);
                              setRejectionReason('');
                              setRejectDialogOpen(true);
                            }}
                          >
                            <X className="w-3.5 h-3.5 mr-1" /> Reject
                          </Button>
                        </div>
                      )}

                      {reservation.status === 'confirmed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          disabled={updateStatusMutation.isPending}
                          onClick={() => updateStatusMutation.mutate({ id: reservation.id, status: 'completed' })}
                        >
                          Mark as Completed
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </StaffLayout>

      <Dialog open={rejectDialogOpen} onOpenChange={(open) => {
        setRejectDialogOpen(open);
        if (!open) {
          setRejectingId(null);
          setRejectionReason('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Reservation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Optionally provide a reason for the rejection.</p>
            <textarea
              placeholder="Reason for rejection (optional)"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
