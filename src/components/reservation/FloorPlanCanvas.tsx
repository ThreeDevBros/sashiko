import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, MouseEvent as ReactMouseEvent, RefObject, SetStateAction } from 'react';
import { TableObject } from '@/components/layout/TableObject';
import { cn } from '@/lib/utils';

export interface LayoutObject {
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

export type TableAvailabilityStatus = 'available' | 'reserved' | 'unavailable';

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface FloorPlanCanvasProps {
  viewportRef: RefObject<HTMLDivElement>;
  zoom: number;
  pan: { x: number; y: number };
  setZoom: Dispatch<SetStateAction<number>>;
  setPan: Dispatch<SetStateAction<{ x: number; y: number }>>;
  currentObjects: LayoutObject[];
  partySize?: number;
  maxSeatsForParty?: number;
  reservedTableIds?: Set<string>;
  dateTimeValid?: boolean;
  hoveredTableId: string | null;
  setHoveredTableId: (id: string | null) => void;
  handleTableClick: (table: LayoutObject) => void;
  height: string;
  bounds: Bounds;
  minZoom: number;
  tableStatesOverride?: Partial<Record<string, TableAvailabilityStatus>>;
  clickableStatuses?: TableAvailabilityStatus[];
  showLegend?: boolean;
  showStatusBadges?: boolean;
  showStatusRings?: boolean;
  legendLabels?: Partial<Record<TableAvailabilityStatus, string>>;
  statusHints?: Partial<Record<TableAvailabilityStatus, string>>;
}

const MAX_ZOOM = 3;
const AVAILABLE_HSL = '142 71% 45%';

const STATUS_STYLES: Record<TableAvailabilityStatus, { ring: string; glow: string; badgeBg: string; badgeText: string; badgeBorder: string }> = {
  available: {
    ring: `hsl(${AVAILABLE_HSL})`,
    glow: `hsl(${AVAILABLE_HSL} / 0.28)`,
    badgeBg: `hsl(${AVAILABLE_HSL} / 0.16)`,
    badgeText: `hsl(142 71% 58%)`,
    badgeBorder: `hsl(${AVAILABLE_HSL} / 0.35)`,
  },
  reserved: {
    ring: 'hsl(var(--destructive))',
    glow: 'hsl(var(--destructive) / 0.28)',
    badgeBg: 'hsl(var(--destructive) / 0.16)',
    badgeText: 'hsl(var(--destructive))',
    badgeBorder: 'hsl(var(--destructive) / 0.35)',
  },
  unavailable: {
    ring: 'hsl(var(--border))',
    glow: 'hsl(var(--border) / 0.25)',
    badgeBg: 'hsl(var(--muted) / 0.9)',
    badgeText: 'hsl(var(--muted-foreground))',
    badgeBorder: 'hsl(var(--border))',
  },
};

function clampPan(pan: { x: number; y: number }, zoom: number, bounds: Bounds, vpW: number, vpH: number) {
  const contentW = (bounds.maxX - bounds.minX) * zoom;
  const contentH = (bounds.maxY - bounds.minY) * zoom;

  let x = pan.x;
  let y = pan.y;

  if (contentW <= vpW) {
    x = (vpW - contentW) / 2 - bounds.minX * zoom;
  } else {
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

export function FloorPlanCanvas({
  viewportRef,
  zoom,
  pan,
  setZoom,
  setPan,
  currentObjects,
  partySize,
  maxSeatsForParty,
  reservedTableIds,
  dateTimeValid = true,
  hoveredTableId,
  setHoveredTableId,
  handleTableClick,
  height,
  bounds,
  minZoom,
  tableStatesOverride,
  clickableStatuses = ['available'],
  showLegend = true,
  showStatusBadges,
  showStatusRings = true,
  legendLabels,
  statusHints,
}: FloorPlanCanvasProps) {
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null);
  const touchMovedRef = useRef(false);
  const touchStartPosRef = useRef({ x: 0, y: 0 });

  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const boundsRef = useRef(bounds);
  const minZoomRef = useRef(minZoom);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    boundsRef.current = bounds;
  }, [bounds]);

  useEffect(() => {
    minZoomRef.current = minZoom;
  }, [minZoom]);

  const getVpSize = useCallback(() => {
    const vp = viewportRef.current;
    return vp ? { w: vp.clientWidth, h: vp.clientHeight } : { w: 400, h: 400 };
  }, [viewportRef]);

  const applyClampedPan = useCallback((newPan: { x: number; y: number }, nextZoom?: number) => {
    const { w, h } = getVpSize();
    setPan(clampPan(newPan, nextZoom ?? zoomRef.current, boundsRef.current, w, h));
  }, [getVpSize, setPan]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const vp = viewportRef.current;
    if (!vp) return;

    const rect = vp.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const previousZoom = zoomRef.current;
    const factor = e.deltaY < 0 ? 1.12 : 0.88;
    const nextZoom = Math.max(minZoomRef.current, Math.min(MAX_ZOOM, previousZoom * factor));
    const nextPan = {
      x: mouseX - (mouseX - panRef.current.x) * (nextZoom / previousZoom),
      y: mouseY - (mouseY - panRef.current.y) * (nextZoom / previousZoom),
    };

    setZoom(nextZoom);
    applyClampedPan(nextPan, nextZoom);
  }, [applyClampedPan, setZoom, viewportRef]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    vp.addEventListener('wheel', handleWheel, { passive: false });
    return () => vp.removeEventListener('wheel', handleWheel);
  }, [handleWheel, viewportRef]);

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

  const onMouseUp = () => {
    isPanningRef.current = false;
  };

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const TAP_THRESHOLD = 10;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
        touchMovedRef.current = true;
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
        const nextZoom = Math.max(minZoomRef.current, Math.min(MAX_ZOOM, pinchStartRef.current.zoom * (dist / pinchStartRef.current.dist)));
        setZoom(nextZoom);

        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const nextPan = {
          x: panStartRef.current.panX + (midX - panStartRef.current.x),
          y: panStartRef.current.panY + (midY - panStartRef.current.y),
        };

        setPan(clampPan(nextPan, nextZoom, boundsRef.current, w, h));
      } else if (e.touches.length === 1 && isPanningRef.current) {
        const dx = e.touches[0].clientX - touchStartPosRef.current.x;
        const dy = e.touches[0].clientY - touchStartPosRef.current.y;

        if (Math.abs(dx) > TAP_THRESHOLD || Math.abs(dy) > TAP_THRESHOLD) {
          touchMovedRef.current = true;
        }

        e.preventDefault();
        const nextPan = {
          x: panStartRef.current.panX + (e.touches[0].clientX - panStartRef.current.x),
          y: panStartRef.current.panY + (e.touches[0].clientY - panStartRef.current.y),
        };

        setPan(clampPan(nextPan, zoomRef.current, boundsRef.current, w, h));
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
  }, [setPan, setZoom, viewportRef]);

  const defaultLegendLabels: Record<TableAvailabilityStatus, string> = {
    available: 'Available',
    reserved: 'Reserved',
    unavailable: typeof partySize === 'number' ? 'Too small' : 'Unavailable',
  };

  const defaultStatusHints: Record<TableAvailabilityStatus, string> = {
    available: 'Tap to interact',
    reserved: 'Reserved at this time',
    unavailable: dateTimeValid ? (typeof partySize === 'number' ? 'Too small for your party' : 'Unavailable') : 'Select a valid time',
  };

  const legendCopy = { ...defaultLegendLabels, ...legendLabels };
  const statusCopy = { ...defaultStatusHints, ...statusHints };
  const shouldShowStatusBadges = showStatusBadges ?? dateTimeValid;

  const getTableStatus = (obj: LayoutObject): TableAvailabilityStatus => {
    const override = tableStatesOverride?.[obj.id];
    if (override) return override;

    const seats = obj.seats || 4;
    const tooSmall = typeof partySize === 'number' ? seats < partySize : false;
    const tooLarge = typeof maxSeatsForParty === 'number' ? seats > maxSeatsForParty : false;
    const isReserved = reservedTableIds?.has(obj.id) ?? false;

    if (isReserved) return 'reserved';
    if (!dateTimeValid || tooSmall || tooLarge) return 'unavailable';
    return 'available';
  };

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
      <div style={{ position: 'absolute', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', width: 1600, height: 1600 }}>
        {currentObjects.map((obj) => {
          const isTable = obj.type === 'table';
          const tableStatus = isTable ? getTableStatus(obj) : 'unavailable';
          const statusStyle = STATUS_STYLES[tableStatus];
          const isHovered = hoveredTableId === obj.id;
          const isClickable = isTable && clickableStatuses.includes(tableStatus);
          const seats = obj.seats || 4;

          return (
            <div
              key={obj.id}
              className="absolute"
              style={{
                left: obj.x,
                top: obj.y,
                width: obj.width,
                height: obj.height,
                transform: obj.rotation ? `rotate(${obj.rotation}deg)` : undefined,
                overflow: 'visible',
                cursor: isTable ? (isClickable ? 'pointer' : 'default') : 'default',
                transition: 'filter 0.15s ease',
                filter: isHovered && isClickable ? 'brightness(1.08)' : undefined,
                zIndex: isHovered ? 10 : 1,
              }}
              onMouseEnter={() => isTable && setHoveredTableId(obj.id)}
              onMouseLeave={() => setHoveredTableId(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (isClickable) handleTableClick(obj);
              }}
              onTouchEnd={(e) => {
                if (isTable && !touchMovedRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  setHoveredTableId(obj.id);
                  if (isClickable) handleTableClick(obj);
                }
              }}
            >
              {isTable && showStatusRings && (
                <div
                  className="absolute inset-0 rounded-lg z-10 pointer-events-none"
                  style={{
                    boxShadow: `0 0 0 3px ${statusStyle.ring}, 0 0 10px ${statusStyle.glow}`,
                  }}
                />
              )}

              <TableObject
                type={obj.type}
                width={obj.width}
                height={obj.height}
                seats={obj.seats}
                shape={obj.shape}
                zoom={1}
                chairSides={obj.chairSides}
                label={obj.label}
                isDisabled={isTable && tableStatus === 'unavailable'}
              />

              {isTable && shouldShowStatusBadges && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    top: '50%',
                    left: '50%',
                    transform: `rotate(${obj.rotation ? -obj.rotation : 0}deg) translateX(-50%) translateY(-${obj.height / 2 + 24}px)`,
                    transformOrigin: '0 0',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border"
                    style={{
                      backgroundColor: statusStyle.badgeBg,
                      color: statusStyle.badgeText,
                      borderColor: statusStyle.badgeBorder,
                    }}
                  >
                    {legendCopy[tableStatus]}
                  </span>
                </div>
              )}

              {isTable && isHovered && (
                <div
                  className="absolute z-50 pointer-events-none"
                  style={{
                    top: '50%',
                    left: '50%',
                    transform: `rotate(${obj.rotation ? -obj.rotation : 0}deg) translateX(-50%) translateY(-${obj.height / 2 + 52}px)`,
                    transformOrigin: '0 0',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <div className="bg-popover border border-border rounded-lg shadow-xl px-3 py-2 text-xs">
                    <p className="font-semibold text-popover-foreground">{obj.label || `Table ${obj.id.split('-').pop()}`}</p>
                    <p className="text-muted-foreground">{seats} seats</p>
                    <p
                      className={cn('font-medium', tableStatus === 'available' && 'text-foreground', tableStatus === 'reserved' && 'text-destructive', tableStatus === 'unavailable' && 'text-muted-foreground')}
                    >
                      {statusCopy[tableStatus]}
                    </p>
                  </div>
                  <div className="w-2 h-2 bg-popover border-r border-b border-border rotate-45 mx-auto -mt-1" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showLegend && (
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 pointer-events-none">
          {(['available', 'reserved', 'unavailable'] as TableAvailabilityStatus[]).map((status) => (
            <div key={status} className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm border border-border/50 rounded-full px-2.5 py-1">
              <div
                className="w-2.5 h-2.5 rounded-full border"
                style={{
                  backgroundColor: STATUS_STYLES[status].badgeBg,
                  borderColor: STATUS_STYLES[status].badgeBorder,
                }}
              />
              <span className="text-[10px] font-medium text-foreground">{legendCopy[status]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
