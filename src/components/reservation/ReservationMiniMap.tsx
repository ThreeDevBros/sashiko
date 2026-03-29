import { useRef, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TableObject } from '@/components/layout/TableObject';
import { cn } from '@/lib/utils';

interface LayoutObject {
  id: string;
  type: string;
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

interface Props {
  branchId: string;
  highlightTableId: string;
  reservationDate: string;
  startTime: string;
  endTime: string;
}

export function ReservationMiniMap({ branchId, highlightTableId, reservationDate, startTime, endTime }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [objects, setObjects] = useState<LayoutObject[]>([]);
  const [reservedIds, setReservedIds] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('branches').select('layout_data').eq('id', branchId).single();
      if (!data?.layout_data) return;
      const ld = data.layout_data as any;
      let objs: LayoutObject[] = [];
      if (ld.floors) {
        // Find the floor containing the highlighted table
        const targetFloor = ld.floors.find((f: any) =>
          (f.objects || []).some((obj: any) => obj.id === highlightTableId)
        );
        objs = (targetFloor || ld.floors[0])?.objects || [];
      } else {
        objs = ld.objects || [];
      }
      setObjects(objs);
    })();
  }, [branchId]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('table_reservations')
        .select('table_object_id, start_time, end_time')
        .eq('branch_id', branchId)
        .eq('reservation_date', reservationDate)
        .not('status', 'in', '("cancelled","no_show","rejected")');
      if (!data) return;
      const ids = new Set(
        data.filter(r => r.start_time < endTime && r.end_time > startTime)
          .map(r => r.table_object_id)
      );
      setReservedIds(ids);
    })();
  }, [branchId, reservationDate, startTime, endTime]);

  const fitToView = useCallback(() => {
    const el = ref.current;
    if (!el || objects.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objects.forEach(o => {
      minX = Math.min(minX, o.x - 30);
      minY = Math.min(minY, o.y - 30);
      maxX = Math.max(maxX, o.x + o.width + 30);
      maxY = Math.max(maxY, o.y + o.height + 30);
    });
    const w = el.clientWidth, h = el.clientHeight;
    const cw = maxX - minX, ch = maxY - minY;
    const z = Math.max(0.15, Math.min(1.5, Math.min(w / cw, h / ch) * 0.85));
    setZoom(z);
    setPan({ x: (w - cw * z) / 2 - minX * z, y: (h - ch * z) / 2 - minY * z });
  }, [objects]);

  useEffect(() => { if (objects.length) setTimeout(fitToView, 50); }, [objects, fitToView]);

  if (!objects.length) return null;

  return (
    <div className="rounded-lg border bg-muted/30 overflow-hidden">
      <div ref={ref} className="relative select-none" style={{ height: 200, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute',
          transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}>
          {objects.map(obj => {
            const isTable = obj.type === 'table';
            const isHighlighted = obj.id === highlightTableId;
            const isReserved = isTable && reservedIds.has(obj.id) && !isHighlighted;

            return (
              <div key={obj.id} className="absolute" style={{
                left: obj.x, top: obj.y, width: obj.width, height: obj.height,
                transform: obj.rotation ? `rotate(${obj.rotation}deg)` : undefined,
                overflow: 'visible',
              }}>
                {isTable && (
                  <div
                    className={cn("absolute inset-0 rounded-lg z-10 pointer-events-none", isHighlighted && "animate-pulse")}
                    style={{
                      boxShadow: isHighlighted
                        ? '0 0 0 3px #eab308, 0 0 16px rgba(234,179,8,0.6)'
                        : isReserved
                        ? '0 0 0 2px #ef4444, 0 0 6px rgba(239,68,68,0.3)'
                        : '0 0 0 2px #22c55e, 0 0 6px rgba(34,197,94,0.3)',
                    }}
                  />
                )}
                <TableObject type={obj.type as any} width={obj.width} height={obj.height} seats={obj.seats} shape={obj.shape} zoom={1} label={obj.label} chairSides={obj.chairSides} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex gap-3 px-3 py-1.5 border-t bg-background/80 text-[10px]">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full border-2 border-yellow-500 bg-yellow-500/20 inline-block" />Selected</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-600/70 inline-block" />Available</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500/70 inline-block" />Reserved</span>
      </div>
    </div>
  );
}
