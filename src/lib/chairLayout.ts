/**
 * Generates chairs evenly distributed around a table shape.
 * For 'circle' (oval/ellipse) shapes, uses proper ellipse math with separate semi-axes.
 * For rectangular/square shapes, distributes chairs along the sides.
 */

interface Chair {
  id: string;
  x: number;
  y: number;
  rotation: number;
}

const CHAIR_SIZE = 16;
const CHAIR_GAP = 4;

/**
 * For an ellipse with semi-axes a, b at a given angle θ:
 * - Point on ellipse: (a·cosθ, b·sinθ)
 * - Normal direction (outward) at that point: (cosθ/a, sinθ/b) normalized
 * - We place the chair at the ellipse edge + offset along the normal
 */
function generateEllipseChairs(
  seats: number,
  width: number,
  height: number,
  chairSize: number = CHAIR_SIZE,
  gap: number = CHAIR_GAP
): Chair[] {
  const chairs: Chair[] = [];
  const a = width / 2;  // semi-axis x
  const b = height / 2; // semi-axis y
  const offset = chairSize / 2 + gap;

  for (let i = 0; i < seats; i++) {
    const angle = (i / seats) * 2 * Math.PI - Math.PI / 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Point on ellipse perimeter
    const ex = a * cosA;
    const ey = b * sinA;

    // Outward normal of ellipse at this point: (cosA/a, sinA/b) normalized
    const nx = cosA / a;
    const ny = sinA / b;
    const nLen = Math.sqrt(nx * nx + ny * ny);
    const nxNorm = nx / nLen;
    const nyNorm = ny / nLen;

    // Chair center position (relative to table center)
    const cx = ex + nxNorm * offset;
    const cy = ey + nyNorm * offset;

    // Rotation: face inward (normal points outward, so rotate 180° from normal direction)
    const rotationDeg = (Math.atan2(nyNorm, nxNorm) * 180 / Math.PI) + 90;

    chairs.push({
      id: `chair-${i}`,
      x: a + cx - chairSize / 2,
      y: b + cy - chairSize / 2,
      rotation: ((rotationDeg % 360) + 360) % 360
    });
  }
  return chairs;
}

/**
 * Snap a dragged chair back onto the ellipse perimeter.
 * Returns the snapped position and rotation.
 */
export function snapChairToEllipse(
  chairX: number,
  chairY: number,
  tableWidth: number,
  tableHeight: number,
  chairSize: number = CHAIR_SIZE,
  gap: number = CHAIR_GAP
): { x: number; y: number; rotation: number } {
  const a = tableWidth / 2;
  const b = tableHeight / 2;
  const offset = chairSize / 2 + gap;

  // Chair center relative to table center
  const dx = (chairX + chairSize / 2) - a;
  const dy = (chairY + chairSize / 2) - b;
  const angle = Math.atan2(dy, dx);

  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  // Point on ellipse
  const ex = a * cosA;
  const ey = b * sinA;

  // Normal
  const nx = cosA / a;
  const ny = sinA / b;
  const nLen = Math.sqrt(nx * nx + ny * ny);
  const nxNorm = nx / nLen;
  const nyNorm = ny / nLen;

  const cx = ex + nxNorm * offset;
  const cy = ey + nyNorm * offset;

  const rotationDeg = (Math.atan2(nyNorm, nxNorm) * 180 / Math.PI) + 90;

  return {
    x: a + cx - chairSize / 2,
    y: b + cy - chairSize / 2,
    rotation: ((rotationDeg % 360) + 360) % 360
  };
}

export function generateChairsForShape(
  shape: string,
  seats: number,
  width: number,
  height: number
): Chair[] {
  const chairSize = CHAIR_SIZE;

  if (shape === 'circle') {
    return generateEllipseChairs(seats, width, height, chairSize, CHAIR_GAP);
  }

  // Rectangular / square logic — distribute chairs evenly along sides
  const chairs: Chair[] = [];
  const isWide = width >= height;
  const gap = CHAIR_GAP;

  // Determine how many chairs go on each side
  let topS = 0, rightS = 0, bottomS = 0, leftS = 0;

  if (seats <= 2) {
    if (isWide) {
      topS = 1;
      bottomS = seats === 2 ? 1 : 0;
    } else {
      leftS = 1;
      rightS = seats === 2 ? 1 : 0;
    }
  } else if (seats <= 4) {
    if (isWide) {
      topS = Math.ceil(seats / 2);
      bottomS = Math.floor(seats / 2);
    } else {
      leftS = Math.ceil(seats / 2);
      rightS = Math.floor(seats / 2);
    }
  } else {
    // For 5+ seats, put chairs on all four sides
    if (isWide) {
      const longSeats = seats <= 4 ? seats : seats - 2;
      topS = Math.ceil(longSeats / 2);
      bottomS = Math.floor(longSeats / 2);
      if (seats > 4) { leftS = 1; rightS = 1; }
    } else {
      const longSeats = seats <= 4 ? seats : seats - 2;
      leftS = Math.ceil(longSeats / 2);
      rightS = Math.floor(longSeats / 2);
      if (seats > 4) { topS = 1; bottomS = 1; }
    }
  }

  let idx = 0;
  // Top side
  for (let i = 0; i < topS; i++) {
    chairs.push({ id: `chair-${idx++}`, x: ((i + 1) * width) / (topS + 1) - chairSize / 2, y: -chairSize - gap, rotation: 0 });
  }
  // Right side
  for (let i = 0; i < rightS; i++) {
    chairs.push({ id: `chair-${idx++}`, x: width + gap, y: ((i + 1) * height) / (rightS + 1) - chairSize / 2, rotation: 90 });
  }
  // Bottom side
  for (let i = 0; i < bottomS; i++) {
    chairs.push({ id: `chair-${idx++}`, x: ((i + 1) * width) / (bottomS + 1) - chairSize / 2, y: height + gap, rotation: 180 });
  }
  // Left side
  for (let i = 0; i < leftS; i++) {
    chairs.push({ id: `chair-${idx++}`, x: -chairSize - gap, y: ((i + 1) * height) / (leftS + 1) - chairSize / 2, rotation: 270 });
  }

  return chairs;
}
