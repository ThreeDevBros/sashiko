import React from 'react';
import {
  Wine, Armchair, PanelTop, DoorOpen, Leaf, ChefHat, Bath,
  ArrowUpDown, Footprints, RectangleHorizontal
} from 'lucide-react';

interface Chair {
  id: string;
  x: number;
  y: number;
  rotation: number;
}

interface TableObjectProps {
  type: 'table' | 'bar' | 'barstool' | 'window' | 'exit' | 'plant' | 'kitchen' | 'toilet' | 'wc' | 'wall' | 'elevator' | 'stairs';
  width: number;
  height: number;
  seats?: number;
  shape?: 'rectangle' | 'circle' | 'square';
  zoom?: number;
  chairSides?: { top?: number; right?: number; bottom?: number; left?: number };
  chairs?: Chair[];
  isDesigner?: boolean;
  label?: string;
  isSelected?: boolean;
  isDisabled?: boolean;
  style?: 'vip' | 'standard' | 'bar';
}

// ─── Seat badge ───────────────────────────────────────────────────────────────
const SeatBadge = ({ count, cx, cy }: { count: number; cx: number; cy: number }) => (
  <g>
    <circle cx={cx} cy={cy} r={10} fill="rgba(0,0,0,0.55)" />
    <text x={cx} y={cy + 4} textAnchor="middle" fontSize="9" fontWeight="700" fill="white" fontFamily="system-ui">
      {count}
    </text>
  </g>
);

// ─── Generate chair positions around a rectangle ─────────────────────────────
const getRectChairPositions = (
  w: number, h: number, seats: number,
  chairSides?: { top?: number; right?: number; bottom?: number; left?: number }
) => {
  const GAP = 4;
  const CS = 18;
  const positions: { x: number; y: number; rotation: number }[] = [];

  if (chairSides) {
    const { top = 0, right = 0, bottom = 0, left = 0 } = chairSides;
    for (let i = 0; i < top; i++) positions.push({ x: ((i + 1) * w) / (top + 1) - CS / 2, y: -CS - GAP, rotation: 0 });
    for (let i = 0; i < right; i++) positions.push({ x: w + GAP, y: ((i + 1) * h) / (right + 1) - CS / 2, rotation: 90 });
    for (let i = 0; i < bottom; i++) positions.push({ x: ((i + 1) * w) / (bottom + 1) - CS / 2, y: h + GAP, rotation: 180 });
    for (let i = 0; i < left; i++) positions.push({ x: -CS - GAP, y: ((i + 1) * h) / (left + 1) - CS / 2, rotation: 270 });
    return positions;
  }

  // Smart distribution based on shape
  const isWide = w >= h;
  if (seats <= 2) {
    if (isWide) {
      positions.push({ x: w / 2 - CS / 2, y: -CS - GAP, rotation: 0 });
      if (seats === 2) positions.push({ x: w / 2 - CS / 2, y: h + GAP, rotation: 180 });
    } else {
      positions.push({ x: -CS - GAP, y: h / 2 - CS / 2, rotation: 270 });
      if (seats === 2) positions.push({ x: w + GAP, y: h / 2 - CS / 2, rotation: 90 });
    }
  } else {
    let topSeats = 0, bottomSeats = 0, leftSeats = 0, rightSeats = 0;
    if (isWide) {
      const longSeats = seats <= 4 ? seats : seats - 2;
      topSeats = Math.ceil(longSeats / 2);
      bottomSeats = Math.floor(longSeats / 2);
      if (seats > 4) { leftSeats = 1; rightSeats = 1; }
    } else {
      const longSeats = seats <= 4 ? seats : seats - 2;
      leftSeats = Math.ceil(longSeats / 2);
      rightSeats = Math.floor(longSeats / 2);
      if (seats > 4) { topSeats = 1; bottomSeats = 1; }
    }
    for (let i = 0; i < topSeats; i++) positions.push({ x: ((i + 1) * w) / (topSeats + 1) - CS / 2, y: -CS - GAP, rotation: 0 });
    for (let i = 0; i < rightSeats; i++) positions.push({ x: w + GAP, y: ((i + 1) * h) / (rightSeats + 1) - CS / 2, rotation: 90 });
    for (let i = 0; i < bottomSeats; i++) positions.push({ x: ((i + 1) * w) / (bottomSeats + 1) - CS / 2, y: h + GAP, rotation: 180 });
    for (let i = 0; i < leftSeats; i++) positions.push({ x: -CS - GAP, y: ((i + 1) * h) / (leftSeats + 1) - CS / 2, rotation: 270 });
  }
  return positions;
};

// ─── Generate chair positions around an ellipse/circle ────────────────────────
const getCircleChairPositions = (w: number, h: number, seats: number) => {
  const CS = 18;
  const GAP = 2;
  const a = w / 2;  // semi-axis x
  const b = h / 2;  // semi-axis y
  const offset = CS / 2 + GAP;
  const positions: { x: number; y: number; rotation: number }[] = [];

  for (let i = 0; i < seats; i++) {
    const angle = (i / seats) * 2 * Math.PI - Math.PI / 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Point on ellipse perimeter
    const ex = a * cosA;
    const ey = b * sinA;

    // Outward normal of ellipse: (cosA/a, sinA/b) normalized
    const nx = cosA / a;
    const ny = sinA / b;
    const nLen = Math.sqrt(nx * nx + ny * ny);
    const nxN = nx / nLen;
    const nyN = ny / nLen;

    // Chair center
    const cx = ex + nxN * offset;
    const cy = ey + nyN * offset;

    const rotDeg = (Math.atan2(nyN, nxN) * 180 / Math.PI) + 90;

    positions.push({
      x: a + cx - CS / 2,
      y: b + cy - CS / 2,
      rotation: ((rotDeg % 360) + 360) % 360,
    });
  }
  return positions;
};

// ─── Icon configs for non-table objects (no emojis) ────────────────────────────
const objConfig: Record<string, { fill: string; label: string; Icon: React.ElementType }> = {
  bar:      { fill: 'linear-gradient(135deg, #7c5c2e 0%, #a07340 100%)', label: 'Bar', Icon: Wine },
  barstool: { fill: 'linear-gradient(135deg, #5c3d1e 0%, #7c5030 100%)', label: 'Stool', Icon: Armchair },
  window:   { fill: 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)', label: 'Window', Icon: PanelTop },
  exit:     { fill: 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)', label: 'Exit', Icon: DoorOpen },
  plant:    { fill: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)', label: 'Plant', Icon: Leaf },
  kitchen:  { fill: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 100%)', label: 'Kitchen', Icon: ChefHat },
  toilet:   { fill: 'linear-gradient(135deg, #67e8f9 0%, #06b6d4 100%)', label: 'WC', Icon: Bath },
  wc:       { fill: 'linear-gradient(135deg, #67e8f9 0%, #06b6d4 100%)', label: 'WC', Icon: Bath },
  wall:     { fill: 'linear-gradient(135deg, #52525b 0%, #27272a 100%)', label: '', Icon: RectangleHorizontal },
  elevator: { fill: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)', label: 'Elevator', Icon: ArrowUpDown },
  stairs:   { fill: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)', label: 'Stairs', Icon: Footprints },
};

// ─── Main component ────────────────────────────────────────────────────────────
export const TableObject = ({
  type,
  width,
  height,
  seats = 4,
  shape = 'rectangle',
  zoom = 1,
  chairSides,
  chairs,
  isDesigner = false,
  label,
  isSelected = false,
  isDisabled = false,
  style = 'standard',
}: TableObjectProps) => {
  const w = width;
  const h = height;
  const isCircle = shape === 'circle';
  const CHAIR_SIZE = Math.max(12, Math.min(20, 18));

  const showBuiltInChairs = type === 'table' && !(isDesigner && chairs && chairs.length > 0);
  const chairPositions = showBuiltInChairs
    ? isCircle
      ? getCircleChairPositions(w, h, seats)
      : getRectChairPositions(w, h, seats, chairSides)
    : [];

  // ─── Non-table objects (clean vector icons, no emojis) ─────────────────
  if (type !== 'table') {
    const cfg = objConfig[type] || objConfig.wall;
    const IconComponent = cfg.Icon;
    const iconSize = Math.max(14, w * 0.3);

    return (
      <div className="relative w-full h-full">
        <div
          className="w-full h-full flex flex-col items-center justify-center rounded"
          style={{
            background: cfg.fill,
            boxShadow: '0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
            opacity: isDisabled ? 0.35 : 1,
          }}
        >
          {type !== 'wall' && (
            <>
              <IconComponent size={iconSize} className="text-white" strokeWidth={2} />
              <span className="text-white font-semibold mt-0.5 pointer-events-none" style={{ fontSize: Math.max(8, w * 0.12) }}>
                {label || cfg.label}
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── Table fills & gradients ─────────────────────────────────────────────
  const tableGradient =
    style === 'vip'
      ? { from: '#c9a84c', mid: '#a07030', to: '#7a5020' }
      : style === 'bar'
      ? { from: '#8b6340', mid: '#6b4820', to: '#4a3010' }
      : { from: '#c8a87a', mid: '#a07850', to: '#7a5830' };

  const svgPad = CHAIR_SIZE + 6;
  const svgW = w + svgPad * 2;
  const svgH = h + svgPad * 2;

  return (
    <div
      className="relative"
      style={{ width: svgW, height: svgH, marginLeft: -svgPad, marginTop: -svgPad }}
    >
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        overflow="visible"
        style={{ display: 'block' }}
      >
        <defs>
          <radialGradient id={`tg-${w}-${h}`} cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor={tableGradient.from} />
            <stop offset="60%" stopColor={tableGradient.mid} />
            <stop offset="100%" stopColor={tableGradient.to} />
          </radialGradient>
          <filter id="tbl-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="rgba(0,0,0,0.4)" />
          </filter>
          {isSelected && (
            <filter id="tbl-glow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feFlood floodColor="hsl(var(--primary))" floodOpacity="0.8" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
        </defs>

        {/* Built-in chairs */}
        {chairPositions.map((pos, idx) => (
          <g key={idx} transform={`translate(${svgPad + pos.x + CHAIR_SIZE / 2}, ${svgPad + pos.y + CHAIR_SIZE / 2})`}>
            <g transform={`rotate(${pos.rotation})`}>
              <rect x={-CHAIR_SIZE / 2} y={-CHAIR_SIZE / 2 + 3} width={CHAIR_SIZE} height={CHAIR_SIZE - 3} rx="2.5" fill={isDesigner ? 'hsl(var(--secondary))' : '#c8a07a'} />
              <rect x={-CHAIR_SIZE / 2} y={-CHAIR_SIZE / 2} width={CHAIR_SIZE} height={7} rx="2" fill={isDesigner ? 'hsl(var(--primary) / 0.8)' : '#8b6040'} />
              <rect x={-CHAIR_SIZE / 2 + 2} y={-CHAIR_SIZE / 2 + 1.5} width={CHAIR_SIZE - 4} height={2} rx="1" fill="rgba(255,255,255,0.3)" />
              <ellipse cx={0} cy={CHAIR_SIZE / 2 + 1} rx={CHAIR_SIZE / 2 - 1} ry={2} fill="rgba(0,0,0,0.18)" />
            </g>
          </g>
        ))}

        {/* Custom chairs (designer mode) */}
        {isDesigner && chairs && chairs.map((chair) => (
          <g key={chair.id} transform={`translate(${svgPad + chair.x + CHAIR_SIZE / 2}, ${svgPad + chair.y + CHAIR_SIZE / 2})`}>
            <g transform={`rotate(${chair.rotation})`}>
              <rect x={-CHAIR_SIZE / 2} y={-CHAIR_SIZE / 2 + 3} width={CHAIR_SIZE} height={CHAIR_SIZE - 3} rx="2.5" fill="hsl(var(--secondary))" />
              <rect x={-CHAIR_SIZE / 2} y={-CHAIR_SIZE / 2} width={CHAIR_SIZE} height={7} rx="2" fill="hsl(var(--primary) / 0.8)" />
              <rect x={-CHAIR_SIZE / 2 + 2} y={-CHAIR_SIZE / 2 + 1.5} width={CHAIR_SIZE - 4} height={2} rx="1" fill="rgba(255,255,255,0.3)" />
            </g>
          </g>
        ))}

        {/* Table surface */}
        <g
          transform={`translate(${svgPad}, ${svgPad})`}
          filter={isSelected ? 'url(#tbl-glow)' : 'url(#tbl-shadow)'}
          opacity={isDisabled ? 0.35 : 1}
        >
          {isCircle ? (
            <>
              <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill="rgba(0,0,0,0.15)" />
              <ellipse cx={w / 2} cy={h / 2 - 1} rx={w / 2 - 1} ry={h / 2 - 1} fill={`url(#tg-${w}-${h})`} />
              <ellipse cx={w / 2 - w * 0.1} cy={h / 2 - h * 0.2} rx={w * 0.25} ry={h * 0.15} fill="rgba(255,255,255,0.12)" />
              <ellipse cx={w / 2} cy={h / 2} rx={w * 0.3} ry={h * 0.3} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
              <ellipse cx={w / 2} cy={h / 2} rx={w * 0.15} ry={h * 0.15} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
            </>
          ) : (
            <>
              <rect x={2} y={3} width={w} height={h} rx="4" fill="rgba(0,0,0,0.18)" />
              <rect x={0} y={0} width={w} height={h} rx="4" fill={`url(#tg-${w}-${h})`} />
              <rect x={1} y={0} width={w - 2} height={2} rx="1" fill="rgba(255,255,255,0.2)" />
              <line x1={w * 0.3} y1={4} x2={w * 0.3} y2={h - 4} stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
              <line x1={w * 0.6} y1={4} x2={w * 0.6} y2={h - 4} stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
              <rect x={w * 0.1} y={2} width={w * 0.35} height={h * 0.3} rx="2" fill="rgba(255,255,255,0.08)" />
            </>
          )}

          {seats > 0 && <SeatBadge count={seats} cx={w / 2} cy={h / 2} />}

          {label && (
            <text x={w / 2} y={h / 2 + 16} textAnchor="middle" fontSize={Math.max(8, Math.min(11, w * 0.13))} fontWeight="600" fill="rgba(255,255,255,0.9)" fontFamily="system-ui">
              {label}
            </text>
          )}
        </g>
      </svg>
    </div>
  );
};
