import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Users, MapPin, ZoomIn, ZoomOut, Maximize2, Calendar as CalendarIcon, Clock, Layers, ChevronDown, X, Crosshair } from 'lucide-react';
import { BookingDialog } from '@/components/booking/BookingDialog';
import { TableObject } from '@/components/layout/TableObject';
import { useBranch } from '@/hooks/useBranch';
import { PartySizeDialog } from '@/components/booking/PartySizeDialog';
import { BranchSelectorDialog } from '@/components/BranchSelectorDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { BackButton } from '@/components/BackButton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LayoutObject {
  id: string;
  type: 'table' | 'bar' | 'barstool' | 'window' | 'exit' | 'plant' | 'kitchen' | 'toilet' | 'wc' | 'wall' | 'elevator' | 'stairs';
  x: number;
  y: number;
  width: number;
  height: number;
  seats?: number;
  shape?: 'rectangle' | 'circle' | 'square';
  chairSides?: { top?: number; right?: number; bottom?: number; left?: number };
  label?: string;
  rotation?: number;
}

interface FloorData {
  id: string;
  name: string;
  objects: LayoutObject[];
}

const CANVAS_W = 1600;
const CANVAS_H = 1600;
const MAX_ZOOM = 3;
const BOUNDARY_PADDING = 60; // px padding around bounding box

// Compute bounding box of all objects
function computeBounds(objects: LayoutObject[]) {
  if (objects.length === 0) return { minX: 0, minY: 0, maxX: CANVAS_W, maxY: CANVAS_H };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  objects.forEach(obj => {
    minX = Math.min(minX, obj.x - BOUNDARY_PADDING);
    minY = Math.min(minY, obj.y - BOUNDARY_PADDING);
    maxX = Math.max(maxX, obj.x + obj.width + BOUNDARY_PADDING);
    maxY = Math.max(maxY, obj.y + obj.height + BOUNDARY_PADDING);
  });
  return { minX, minY, maxX, maxY };
}

// Compute the minimum zoom that fits bounds inside the viewport
function computeMinZoom(bounds: ReturnType<typeof computeBounds>, vpW: number, vpH: number) {
  const contentW = bounds.maxX - bounds.minX;
  const contentH = bounds.maxY - bounds.minY;
  if (contentW <= 0 || contentH <= 0) return 0.15;
  return Math.min(vpW / contentW, vpH / contentH) * 0.85;
}

// Clamp pan so the layout stays visible inside the viewport
function clampPan(pan: { x: number; y: number }, zoom: number, bounds: ReturnType<typeof computeBounds>, vpW: number, vpH: number) {
  const contentW = (bounds.maxX - bounds.minX) * zoom;
  const contentH = (bounds.maxY - bounds.minY) * zoom;

  let x = pan.x;
  let y = pan.y;

  // If content is smaller than viewport, center it
  if (contentW <= vpW) {
    x = (vpW - contentW) / 2 - bounds.minX * zoom;
  } else {
    // Don't let right edge go past viewport right, or left edge past viewport left
    const maxPanX = -bounds.minX * zoom;
    const minPanX = vpW - bounds.maxX * zoom;
    x = Math.min(maxPanX, Math.max(minPanX, x));
  }

  if (contentH <= vpH) {
    y = (vpH - contentH) / 2 - bounds.minY * zoom;
  } else {
    const maxPanY = -bounds.minY * zoom;
    const minPanY = vpH - bounds.maxY * zoom;
    y = Math.min(maxPanY, Math.max(minPanY, y));
  }

  return { x, y };
}

// ─── Reusable interactive floor plan canvas ────────────────────────
interface FloorPlanCanvasProps {
  viewportRef: React.RefObject<HTMLDivElement>;
  zoom: number;
  pan: { x: number; y: number };
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  currentObjects: LayoutObject[];
  partySize: number;
  maxSeatsForParty: number;
  reservedTableIds: Set<string>;
  dateTimeValid: boolean;
  hoveredTableId: string | null;
  setHoveredTableId: (id: string | null) => void;
  handleTableClick: (table: LayoutObject) => void;
  height: string;
  bounds: ReturnType<typeof computeBounds>;
  minZoom: number;
}

function FloorPlanCanvas({
  viewportRef, zoom, pan, setZoom, setPan,
  currentObjects, partySize, maxSeatsForParty, reservedTableIds,
  dateTimeValid, hoveredTableId, setHoveredTableId, handleTableClick, height,
  bounds, minZoom,
}: FloorPlanCanvasProps) {
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null);

  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const boundsRef = useRef(bounds);
  const minZoomRef = useRef(minZoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { boundsRef.current = bounds; }, [bounds]);
  useEffect(() => { minZoomRef.current = minZoom; }, [minZoom]);

  const getVpSize = useCallback(() => {
    const vp = viewportRef.current;
    return vp ? { w: vp.clientWidth, h: vp.clientHeight } : { w: 400, h: 400 };
  }, [viewportRef]);

  // Clamp helper using current refs
  const applyClampedPan = useCallback((newPan: { x: number; y: number }, z?: number) => {
    const { w, h } = getVpSize();
    const clamped = clampPan(newPan, z ?? zoomRef.current, boundsRef.current, w, h);
    setPan(clamped);
  }, [getVpSize, setPan]);

  // Desktop: wheel zoom centered on cursor
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const vp = viewportRef.current;
    if (!vp) return;
    const rect = vp.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const prev = zoomRef.current;
    const factor = e.deltaY < 0 ? 1.12 : 0.88;
    const next = Math.max(minZoomRef.current, Math.min(MAX_ZOOM, prev * factor));
    const newPan = {
      x: mx - (mx - panRef.current.x) * (next / prev),
      y: my - (my - panRef.current.y) * (next / prev),
    };
    setZoom(next);
    const { w, h } = getVpSize();
    setPan(clampPan(newPan, next, boundsRef.current, w, h));
  }, [viewportRef, setZoom, setPan, getVpSize]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    vp.addEventListener('wheel', handleWheel, { passive: false });
    return () => vp.removeEventListener('wheel', handleWheel);
  }, [handleWheel, viewportRef]);

  // Mouse pan
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isPanningRef.current = true;
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: panRef.current.x, panY: panRef.current.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    applyClampedPan({
      x: panStartRef.current.panX + (e.clientX - panStartRef.current.x),
      y: panStartRef.current.panY + (e.clientY - panStartRef.current.y),
    });
  };
  const onMouseUp = () => { isPanningRef.current = false; };

  const touchMovedRef = useRef(false);
  const touchStartPosRef = useRef({ x: 0, y: 0 });

  // Touch: two-finger pinch+pan, one-finger pan, tap detection
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const TAP_THRESHOLD = 10; // px - max movement to count as tap

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
        touchMovedRef.current = true; // multi-touch is not a tap
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartRef.current = { dist: Math.hypot(dx, dy), zoom: zoomRef.current };
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        panStartRef.current = { x: midX, y: midY, panX: panRef.current.x, panY: panRef.current.y };
      } else if (e.touches.length === 1) {
        e.preventDefault();
        touchMovedRef.current = false;
        touchStartPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        isPanningRef.current = true;
        panStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, panX: panRef.current.x, panY: panRef.current.y };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const { w, h } = { w: vp.clientWidth, h: vp.clientHeight };
      if (e.touches.length >= 2 && pinchStartRef.current) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const newZoom = Math.max(minZoomRef.current, Math.min(MAX_ZOOM, pinchStartRef.current.zoom * (dist / pinchStartRef.current.dist)));
        setZoom(newZoom);
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const newPan = {
          x: panStartRef.current.panX + (midX - panStartRef.current.x),
          y: panStartRef.current.panY + (midY - panStartRef.current.y),
        };
        setPan(clampPan(newPan, newZoom, boundsRef.current, w, h));
      } else if (e.touches.length === 1 && isPanningRef.current) {
        const dx = e.touches[0].clientX - touchStartPosRef.current.x;
        const dy = e.touches[0].clientY - touchStartPosRef.current.y;
        if (Math.abs(dx) > TAP_THRESHOLD || Math.abs(dy) > TAP_THRESHOLD) {
          touchMovedRef.current = true;
        }
        e.preventDefault();
        const newPan = {
          x: panStartRef.current.panX + (e.touches[0].clientX - panStartRef.current.x),
          y: panStartRef.current.panY + (e.touches[0].clientY - panStartRef.current.y),
        };
        setPan(clampPan(newPan, zoomRef.current, boundsRef.current, w, h));
      }
    };

    const handleTouchEnd = () => {
      pinchStartRef.current = null;
      isPanningRef.current = false;
    };

    vp.addEventListener('touchstart', handleTouchStart, { passive: false });
    vp.addEventListener('touchmove', handleTouchMove, { passive: false });
    vp.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      vp.removeEventListener('touchstart', handleTouchStart);
      vp.removeEventListener('touchmove', handleTouchMove);
      vp.removeEventListener('touchend', handleTouchEnd);
    };
  }, [viewportRef, setZoom, setPan]);

  return (
    <div
      ref={viewportRef}
      className="relative border border-border/50 rounded-xl overflow-hidden bg-[hsl(var(--muted)/0.15)] select-none"
      style={{
        height,
        cursor: isPanningRef.current ? 'grabbing' : 'grab',
        overscrollBehavior: 'contain',
        touchAction: 'none',
        backgroundImage: `linear-gradient(hsl(var(--border)/0.4) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)/0.4) 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div style={{ position: 'absolute', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', width: CANVAS_W, height: CANVAS_H }}>
        {currentObjects.map((obj: LayoutObject) => {
          const isTable = obj.type === 'table';
          const seats = obj.seats || 4;
          const isTooSmall = isTable && seats < partySize;
          const isReserved = isTable && reservedTableIds.has(obj.id);
          const isAvailable = isTable && seats >= partySize && seats <= maxSeatsForParty && !isReserved;
          const isDisabled = isTooSmall || isReserved;
          const isHovered = hoveredTableId === obj.id;

          return (
            <div
              key={obj.id}
              className="absolute"
              style={{
                left: obj.x, top: obj.y, width: obj.width, height: obj.height,
                transform: obj.rotation ? `rotate(${obj.rotation}deg)` : undefined,
                overflow: 'visible',
                cursor: isTable ? (isDisabled ? 'not-allowed' : 'pointer') : 'default',
                transition: 'filter 0.15s',
                filter: isHovered && isAvailable ? 'brightness(1.15) drop-shadow(0 0 8px hsl(120 60% 40% / 0.6))' : isReserved ? 'saturate(0.5) brightness(0.85)' : undefined,
                zIndex: isHovered ? 10 : 1,
              }}
              onMouseEnter={() => isTable && setHoveredTableId(obj.id)}
              onMouseLeave={() => setHoveredTableId(null)}
              onClick={(e) => { e.stopPropagation(); if (isTable) handleTableClick(obj); }}
              onTouchEnd={(e) => {
                if (isTable && !touchMovedRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  setHoveredTableId(obj.id);
                  handleTableClick(obj);
                }
              }}
            >
              <TableObject type={obj.type} width={obj.width} height={obj.height} seats={obj.seats} shape={obj.shape} zoom={1} chairSides={obj.chairSides} label={obj.label} isDisabled={isTooSmall} />

              {isTable && dateTimeValid && (
                <div className="absolute pointer-events-none" style={{ top: '50%', left: '50%', transform: `rotate(${obj.rotation ? -obj.rotation : 0}deg) translateX(-50%) translateY(-${obj.height / 2 + 24}px)`, transformOrigin: '0 0', whiteSpace: 'nowrap' }}>
                  {isReserved && <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-destructive/90 text-destructive-foreground">Reserved</span>}
                  {isAvailable && <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-green-600/90 text-white">Available</span>}
                </div>
              )}

              {isTable && isHovered && (
                <div className="absolute z-50 pointer-events-none" style={{ top: '50%', left: '50%', transform: `rotate(${obj.rotation ? -obj.rotation : 0}deg) translateX(-50%) translateY(-${obj.height / 2 + 50}px)`, transformOrigin: '0 0', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                  <div className="bg-popover border border-border rounded-lg shadow-xl px-3 py-2 text-xs">
                    <p className="font-semibold text-popover-foreground">{obj.label || `Table ${obj.id.split('-').pop()}`}</p>
                    <p className="text-muted-foreground">{seats} seats</p>
                    {isTooSmall && <p className="text-destructive font-medium">Too small for your party</p>}
                    {isReserved && <p className="text-destructive font-medium">Reserved at this time</p>}
                    {isAvailable && <p className="text-green-600 font-medium">Tap to reserve</p>}
                  </div>
                  <div className="w-2 h-2 bg-popover border-r border-b border-border rotate-45 mx-auto -mt-1" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 pointer-events-none">
        <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm border border-border/50 rounded-full px-2.5 py-1">
          <div className="w-2.5 h-2.5 rounded-full bg-green-600/70 border border-green-600/40" />
          <span className="text-[10px] font-medium text-foreground">Available</span>
        </div>
        <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm border border-border/50 rounded-full px-2.5 py-1">
          <div className="w-2.5 h-2.5 rounded-full bg-destructive/70 border border-destructive/40" />
          <span className="text-[10px] font-medium text-foreground">Reserved</span>
        </div>
        <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm border border-border/50 rounded-full px-2.5 py-1">
          <div className="w-2.5 h-2.5 rounded-full bg-muted border border-border" />
          <span className="text-[10px] font-medium text-foreground">Too small</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────
export default function TableBooking() {
  const { branch } = useBranch();
  const isMobile = useIsMobile();
  const [partySize, setPartySize] = useState<number>(2);
  const [selectedTable, setSelectedTable] = useState<LayoutObject | null>(null);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [partySizeDialogOpen, setPartySizeDialogOpen] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState('18:00');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);
  const [activeFloorId, setActiveFloorId] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const expandedViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setBranchDialogOpen(true); }, []);

  const handleBranchDialogClose = (open: boolean) => {
    setBranchDialogOpen(open);
    if (!open) setPartySizeDialogOpen(true);
  };

  const { data: branchLayout } = useQuery({
    queryKey: ['branch-layout-booking', branch?.id],
    queryFn: async () => {
      if (!branch?.id) return null;
      const { data, error } = await supabase.from('branches').select('*').eq('id', branch.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!branch?.id,
  });

  const { data: branchHours } = useQuery({
    queryKey: ['branch-hours', branch?.id],
    queryFn: async () => {
      if (!branch?.id) return null;
      const { data } = await supabase.from('branches').select('opens_at, closes_at').eq('id', branch.id).single();
      return data;
    },
    enabled: !!branch?.id,
  });

  const opensAt = branchHours?.opens_at || '09:00';
  const closesAt = branchHours?.closes_at || '23:00';

  const layoutData = branchLayout?.layout_data as any;
  const floors: FloorData[] = (() => {
    if (!layoutData) return [];
    if (layoutData.floors && Array.isArray(layoutData.floors)) {
      return layoutData.floors.map((f: any) => ({
        ...f,
        objects: (f.objects || []).map((obj: any) => ({ ...obj, type: obj.type === 'toilet' ? 'wc' : obj.type }))
      }));
    }
    if (layoutData.objects) {
      return [{ id: 'floor-1', name: 'Ground Floor', objects: (layoutData.objects as any[]).map((obj: any) => ({ ...obj, type: obj.type === 'toilet' ? 'wc' : obj.type })) }];
    }
    return [];
  })();

  useEffect(() => {
    if (floors.length > 0 && !activeFloorId) {
      setActiveFloorId(floors[0].id);
    }
  }, [floors, activeFloorId]);

  const activeFloor = floors.find(f => f.id === activeFloorId) || floors[0];
  const currentObjects: LayoutObject[] = activeFloor?.objects || [];

  // Compute bounds from current objects
  const bounds = useMemo(() => computeBounds(currentObjects), [currentObjects]);

  const { data: existingReservations, refetch: refetchReservations } = useQuery({
    queryKey: ['table-reservations', branch?.id, selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null, selectedTime],
    queryFn: async () => {
      if (!branch?.id || !selectedDate || !selectedTime) return [];
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const [h, m] = selectedTime.split(':').map(Number);
      const endH = h + 2;
      const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const { data, error } = await supabase
        .from('table_reservations')
        .select('table_object_id, status')
        .eq('branch_id', branch.id)
        .eq('reservation_date', dateStr)
        .not('status', 'in', '("cancelled","no_show")')
        .or(`and(start_time.lt.${endTime},end_time.gt.${selectedTime})`);
      if (error) { console.error('Error fetching reservations:', error); return []; }
      return data || [];
    },
    enabled: !!branch?.id && !!selectedDate && !!selectedTime,
  });

  const reservedTableIds = new Set((existingReservations || []).map((r: any) => r.table_object_id));

  const allTables = currentObjects.filter((obj) => obj.type === 'table');
  const maxSeatsForParty = Math.max(partySize + 4, partySize * 2);
  const availableTables = allTables.filter((table) => {
    const seats = table.seats || 4;
    return seats >= partySize && seats <= maxSeatsForParty && !reservedTableIds.has(table.id);
  });

  const largestTable = allTables.reduce((max: number, table) => Math.max(max, table.seats || 4), 0);
  const needsTableCombination = partySize > largestTable;
  const canCombineTables = allTables.reduce((total: number, table) => total + (table.seats || 4), 0) >= partySize;

  const handleTableClick = (table: LayoutObject) => {
    if ((branchLayout as any)?.is_reservations_paused) return;
    if (reservedTableIds.has(table.id)) return;
    const seats = table.seats || 4;
    const maxSeats = Math.max(partySize + 4, partySize * 2);
    if (seats >= partySize && seats <= maxSeats) { setSelectedTable(table); setBookingDialogOpen(true); }
  };

  const handleLargePartyRequest = () => {
    const largest = allTables.reduce((max: LayoutObject, table: LayoutObject) =>
      (table.seats || 4) > (max.seats || 4) ? table : max, allTables[0]);
    setSelectedTable(largest);
    setBookingDialogOpen(true);
  };

  // Fit-to-view — centers and scales to show all objects
  const fitToView = useCallback((targetRef?: React.RefObject<HTMLDivElement>) => {
    const vp = (targetRef || viewportRef).current;
    if (!vp) return;
    const vpW = vp.clientWidth;
    const vpH = vp.clientHeight;

    const fitZoom = computeMinZoom(bounds, vpW, vpH);
    const clampedZoom = Math.max(0.1, Math.min(MAX_ZOOM, fitZoom));
    const contentW = bounds.maxX - bounds.minX;
    const contentH = bounds.maxY - bounds.minY;
    const newPan = {
      x: (vpW - contentW * clampedZoom) / 2 - bounds.minX * clampedZoom,
      y: (vpH - contentH * clampedZoom) / 2 - bounds.minY * clampedZoom,
    };
    setZoom(clampedZoom);
    setPan(newPan);
  }, [bounds]);

  // Recenter — resets both position AND zoom to initial fit
  const recenterLayout = useCallback((targetRef?: React.RefObject<HTMLDivElement>) => {
    fitToView(targetRef);
  }, [fitToView]);

  // Initial fit only — runs once when objects first load
  const hasFittedRef = useRef(false);
  useEffect(() => {
    if (currentObjects.length > 0 && !hasFittedRef.current) {
      hasFittedRef.current = true;
      setTimeout(() => fitToView(), 100);
    }
  }, [currentObjects, fitToView]);

  // Reset fit flag when floor changes
  const handleFloorChange = (floorId: string) => {
    setActiveFloorId(floorId);
    hasFittedRef.current = false;
  };

  // Dynamic min zoom based on viewport size
  const getMinZoom = useCallback((targetRef?: React.RefObject<HTMLDivElement>) => {
    const vp = (targetRef || viewportRef).current;
    if (!vp) return 0.15;
    return computeMinZoom(bounds, vp.clientWidth, vp.clientHeight);
  }, [bounds]);

  const zoomIn = () => setZoom(z => Math.min(MAX_ZOOM, z * 1.2));
  const zoomOut = () => {
    const minZ = getMinZoom();
    setZoom(z => Math.max(minZ, z * 0.8));
  };

  const isTimeInPast = () => {
    if (!selectedDate) return false;
    const today = new Date(); const sd = new Date(selectedDate);
    sd.setHours(0, 0, 0, 0); today.setHours(0, 0, 0, 0);
    if (sd.getTime() === today.getTime()) { const now = new Date(); const [hours, minutes] = selectedTime.split(':').map(Number); const st = new Date(); st.setHours(hours, minutes, 0, 0); return st < now; }
    return false;
  };

  const isOutsideWorkingHours = () => {
    if (!selectedTime) return false;
    const [sh, sm] = selectedTime.split(':').map(Number);
    const [oh, om] = opensAt.split(':').map(Number);
    const [ch, cm] = closesAt.split(':').map(Number);
    return (sh * 60 + sm) < (oh * 60 + om) || (sh * 60 + sm) >= (ch * 60 + cm);
  };

  const dateTimeValid = !!selectedDate && !!selectedTime && !isTimeInPast() && !isOutsideWorkingHours();

  const handleExpand = () => {
    setIsExpanded(true);
    setTimeout(() => fitToView(expandedViewportRef), 150);
  };

  const handleCollapse = () => {
    setIsExpanded(false);
    setTimeout(() => fitToView(viewportRef), 150);
  };

  const canvasProps = {
    zoom, pan, setZoom, setPan,
    currentObjects, partySize, maxSeatsForParty, reservedTableIds,
    dateTimeValid, hoveredTableId, setHoveredTableId, handleTableClick,
    bounds,
  };

  // Zoom controls bar (shared)
  const ZoomControls = ({ onFit, onRecenter }: { onFit: () => void; onRecenter: () => void }) => (
    <div className="flex items-center gap-1.5">
      <Button size="icon" variant="outline" className="h-8 w-8" onClick={zoomOut} title="Zoom out"><ZoomOut className="h-4 w-4" /></Button>
      <span className="text-xs font-mono bg-muted px-2 py-1 rounded min-w-[48px] text-center">{Math.round(zoom * 100)}%</span>
      <Button size="icon" variant="outline" className="h-8 w-8" onClick={zoomIn} title="Zoom in"><ZoomIn className="h-4 w-4" /></Button>
      <Button size="icon" variant="outline" className="h-8 w-8" onClick={onRecenter} title="Recenter layout"><Crosshair className="h-4 w-4" /></Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-24 overflow-x-hidden">
      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-full">
        <BackButton />
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-4xl font-bold mb-2">Reserve a Table</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Choose your branch, party size, date & time to get started</p>
        </div>

        {/* Reservations paused banner */}
        {(branchLayout as any)?.is_reservations_paused && (
          <div className="mb-4 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-center">
            <p className="text-destructive font-semibold text-sm">🚫 This branch is currently not accepting reservations.</p>
          </div>
        )}

        {/* Branch & Party Size selectors */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <Card className="flex-1">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide font-medium">Branch</p>
                <p className="text-xs sm:text-base font-semibold truncate">{branch?.name ?? 'No branch selected'}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setBranchDialogOpen(true)} className="whitespace-nowrap flex-shrink-0">Change</Button>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide font-medium">Party size</p>
                <p className="text-xs sm:text-base font-semibold">{partySize} {partySize === 1 ? 'person' : 'people'}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setPartySizeDialogOpen(true)} className="whitespace-nowrap flex-shrink-0">Change</Button>
            </CardContent>
          </Card>
        </div>

        {/* Date & Time selectors */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div>
            <Label className="text-xs sm:text-sm mb-1.5 block">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-sm", !selectedDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[100] bg-background border shadow-lg" align="start">
                <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} disabled={(date) => { const today = new Date(); today.setHours(0, 0, 0, 0); return date < today; }} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label className="text-xs sm:text-sm mb-1.5 block">Time</Label>
            <Input type="time" value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} min={opensAt} max={closesAt} className="text-sm" />
            {isTimeInPast() && <p className="text-xs text-destructive mt-1">Please select a future time</p>}
            {isOutsideWorkingHours() && <p className="text-xs text-destructive mt-1">Working hours: {opensAt} – {closesAt}</p>}
          </div>
        </div>

        {/* Availability info */}
        <div className="mb-4">
          <p className="text-xs sm:text-sm text-muted-foreground break-words">
            {branch && branchLayout
              ? dateTimeValid
                ? `${availableTables.length} table${availableTables.length !== 1 ? 's' : ''} available for your party`
                : 'Select a date & time to see availability'
              : 'Select a branch to see available tables'}
          </p>
          {needsTableCombination && canCombineTables && (
            <div className="mt-2">
              <p className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-400 mb-2 break-words">
                Large party — table combination required. Admin will arrange seating upon approval.
              </p>
              <Button onClick={handleLargePartyRequest} variant="default" size="sm" className="w-full sm:w-auto">Request Table Arrangement</Button>
            </div>
          )}
          {needsTableCombination && !canCombineTables && (
            <p className="text-xs sm:text-sm text-destructive mt-1 break-words">Party size exceeds restaurant capacity. Please contact us directly.</p>
          )}
        </div>

        {branch && branchLayout && (
          <>
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <CardTitle className="text-base sm:text-xl break-words">
                      Floor Plan — {branchLayout.name}
                    </CardTitle>
                    {floors.length > 1 && (
                      <Select value={activeFloorId} onValueChange={handleFloorChange}>
                        <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm">
                          <Layers className="w-3.5 h-3.5 mr-1.5" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {floors.map(floor => (
                            <SelectItem key={floor.id} value={floor.id}>{floor.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ZoomControls onFit={() => fitToView()} onRecenter={() => recenterLayout()} />
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={handleExpand} title="Expand"><Maximize2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-2 sm:p-4 pb-4">
                <FloorPlanCanvas
                  viewportRef={viewportRef}
                  {...canvasProps}
                  minZoom={getMinZoom()}
                  height={isMobile ? '320px' : '480px'}
                />
                <p className="text-xs text-muted-foreground mt-3">
                  Scroll to zoom · Drag to pan · Pinch to zoom on mobile · <strong>Tap</strong> any available table to reserve
                </p>
              </CardContent>
            </Card>

            {/* Table list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {availableTables.map((table: LayoutObject) => (
                <Card key={table.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="pt-4 sm:pt-6">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <h3 className="text-xs sm:text-base font-semibold mb-2 break-words">{table.label || `Table ${table.id.split('-').pop()}`}</h3>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Users className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                            <span>{table.seats || 4} seats</span>
                          </div>
                        </div>
                      </div>
                      <Button size="sm" className="w-full text-xs sm:text-sm" onClick={() => handleTableClick(table)} disabled={!dateTimeValid}>
                        {dateTimeValid ? 'Book Now' : 'Select date & time first'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ─── Expanded fullscreen overlay ─────────────────────────── */}
      {isExpanded && (
        <div className="fixed inset-0 z-[9999] bg-background flex flex-col" style={{ touchAction: 'none' }}>
          {/* Top bar — clean layout: Close | Floor Selector | Zoom Controls */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-background gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCollapse}
                className="h-9 px-3 gap-1.5 font-medium bg-[#E53935] hover:bg-[#C62828] text-white border-[#E53935] hover:border-[#C62828]"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Close</span>
              </Button>
              {floors.length > 1 && (
                <Select value={activeFloorId} onValueChange={handleFloorChange}>
                  <SelectTrigger className="w-auto min-w-[120px] h-8 text-xs relative z-[10000]">
                    <Layers className="w-3 h-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[10001]">
                    {floors.map(floor => (
                      <SelectItem key={floor.id} value={floor.id}>{floor.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <ZoomControls onFit={() => fitToView(expandedViewportRef)} onRecenter={() => recenterLayout(expandedViewportRef)} />
          </div>

          {/* Canvas */}
          <div className="flex-1 relative">
            <FloorPlanCanvas
              viewportRef={expandedViewportRef}
              {...canvasProps}
              minZoom={getMinZoom(expandedViewportRef)}
              height="100%"
            />
          </div>

          {/* Bottom hint */}
          <div className="px-4 py-2 border-t border-border bg-background">
            <p className="text-xs text-muted-foreground text-center">
              Scroll to zoom · Drag to pan · <strong>Tap</strong> any available table to reserve
            </p>
          </div>
        </div>
      )}

      <BranchSelectorDialog open={branchDialogOpen} onOpenChange={handleBranchDialogClose} />
      <PartySizeDialog open={partySizeDialogOpen} onOpenChange={setPartySizeDialogOpen} partySize={partySize} onPartySizeChange={setPartySize} onConfirm={() => {}} />

      {selectedTable && branch && (
        <BookingDialog
          open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}
          table={selectedTable} branchId={branch.id} branchName={branch.name}
          initialPartySize={partySize} requiresTableCombination={needsTableCombination}
          selectedDate={selectedDate} selectedTime={selectedTime}
          onReservationComplete={() => refetchReservations()}
        />
      )}
    </div>
  );
}
