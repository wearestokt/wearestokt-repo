/**
 * Streamline tracing: Jobard–Lefer even-spacing seeding plus RK4 bidirectional
 * integration through the unified vector field with width-aware collision spacing.
 */

import { assignStrokeColor, type FlowPaletteSettings } from "./flow-palette";
import type { FlowPathSettings } from "./flow-path-math";
import {
  createVectorField,
  type VectorField,
  type VectorFieldSettings,
} from "./flow-vector-field";

export type FlowMarkerStyle = "arrow" | "dash" | "hatch" | "line" | "rectangle";
export type FlowTaper = "both" | "head" | "none" | "tail";
export type SpacingMode = "even" | "loose" | "packed";

export type SizeClass = "base" | "thick" | "thin" | "xl";

export type StreamSettings = {
  density: number;
  gap: number;
  lengthContrast: number;
  lengthMax: number;
  lengthMin: number;
  margin: number;
  smoothness: number;
  spacingMode: SpacingMode;
};

export type FlowStroke = {
  arcT: number[];
  colorHex?: string;
  pointSpeeds: number[];
  points: { x: number; y: number }[];
  sizeClass: SizeClass;
  style: FlowMarkerStyle;
  thickness: number;
};

export type FlowOutput = {
  strokes: FlowStroke[];
};

const MIN_STROKE_POINTS = 3;

const SIZE_CLASS_MULTIPLIERS: Record<SizeClass, number> = {
  base: 1,
  thick: 3,
  thin: 0.3,
  xl: 8,
};

const SIZE_CLASS_LENGTH_SCALE: Record<SizeClass, number> = {
  base: 1,
  thick: 0.55,
  thin: 1.15,
  xl: 0.35,
};

function hash2(ix: number, iy: number, seed: number): number {
  let h =
    (Math.imul(ix | 0, 374_761_393) +
      Math.imul(iy | 0, 668_265_263) +
      Math.imul(seed | 0, 0x9e_37_79_b1)) |
    0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1_274_126_177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4_294_967_295;
}

function curveBend(curvature: number): number {
  return Math.min(1, Math.pow(Math.max(0, curvature) * 2.4, 0.85));
}

export function computeStrokeLength(
  speed: number,
  curvature: number,
  lengthContrast: number,
  lengthMin: number,
  lengthMax: number,
  lengthScale = 1,
): number {
  const mid = (lengthMin + lengthMax) / 2;
  if (lengthContrast <= 0) {
    return mid * lengthScale;
  }
  const strength = lengthContrast / 100;
  const bend = curveBend(curvature) * (1 - speed * 0.35);
  const target = lengthMax * (1 - bend) + lengthMin * bend;
  return (mid + (target - mid) * strength) * lengthScale;
}

export function sampleSizeClass(variety: number, seed: number): SizeClass {
  if (variety <= 0) {
    return "base";
  }
  const strength = variety / 100;
  const roll = hash2(seed, seed >> 3, seed >> 7);
  const thinThreshold = 0.5 * strength;
  const baseThreshold = thinThreshold + 0.3 * strength;
  const thickThreshold = baseThreshold + 0.15 * strength;
  if (roll < thinThreshold) {
    return "thin";
  }
  if (roll < baseThreshold) {
    return "base";
  }
  if (roll < thickThreshold) {
    return "thick";
  }
  return "xl";
}

export function strokeWidthForClass(baseWidth: number, sizeClass: SizeClass): number {
  return Math.max(0.35, baseWidth * SIZE_CLASS_MULTIPLIERS[sizeClass]);
}

function separationFromDensity(density: number, width: number, height: number): number {
  const shortEdge = Math.max(1, Math.min(width, height));
  const normalized = Math.min(100, Math.max(1, density));
  return shortEdge / (4 + (normalized / 100) * 36);
}

function rk4Step(
  field: VectorField,
  x: number,
  y: number,
  step: number,
  direction: 1 | -1,
): { x: number; y: number } {
  const sign = direction;
  const s1 = field.sample(x, y);
  const vx1 = Math.cos(s1.angle) * step * sign;
  const vy1 = Math.sin(s1.angle) * step * sign;

  const s2 = field.sample(x + vx1 * 0.5, y + vy1 * 0.5);
  const vx2 = Math.cos(s2.angle) * step * sign;
  const vy2 = Math.sin(s2.angle) * step * sign;

  const s3 = field.sample(x + vx2 * 0.5, y + vy2 * 0.5);
  const vx3 = Math.cos(s3.angle) * step * sign;
  const vy3 = Math.sin(s3.angle) * step * sign;

  const s4 = field.sample(x + vx3, y + vy3);
  const vx4 = Math.cos(s4.angle) * step * sign;
  const vy4 = Math.sin(s4.angle) * step * sign;

  return {
    x: x + (vx1 + 2 * vx2 + 2 * vx3 + vx4) / 6,
    y: y + (vy1 + 2 * vy2 + 2 * vy3 + vy4) / 6,
  };
}

type OccupancyEntry = {
  width: number;
  x: number;
  y: number;
};

type OccupancyGrid = {
  cellSize: number;
  entries: OccupancyEntry[];
};

function gridKey(x: number, y: number, cellSize: number): string {
  return `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
}

function requiredSeparation(
  mode: SpacingMode,
  baseSeparation: number,
  candidateWidth: number,
  existingWidth: number,
  gap: number,
): number {
  switch (mode) {
    case "packed":
      return candidateWidth * 0.5 + existingWidth * 0.5 + gap;
    case "loose":
      return 0;
    case "even":
    default:
      return baseSeparation;
  }
}

function isTooClose(
  grid: OccupancyGrid,
  x: number,
  y: number,
  candidateWidth: number,
  baseSeparation: number,
  mode: SpacingMode,
  gap: number,
): boolean {
  if (mode === "loose") {
    return false;
  }
  const cx = Math.floor(x / grid.cellSize);
  const cy = Math.floor(y / grid.cellSize);
  const radius = Math.max(1, Math.ceil((baseSeparation + candidateWidth) / grid.cellSize));
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (const entry of grid.entries) {
        const ecx = Math.floor(entry.x / grid.cellSize);
        const ecy = Math.floor(entry.y / grid.cellSize);
        if (ecx !== cx + dx || ecy !== cy + dy) {
          continue;
        }
        const separation = requiredSeparation(mode, baseSeparation, candidateWidth, entry.width, gap);
        if (separation <= 0) {
          continue;
        }
        if (Math.hypot(x - entry.x, y - entry.y) < separation * 0.92) {
          return true;
        }
      }
    }
  }
  return false;
}

function markOccupied(grid: OccupancyGrid, x: number, y: number, width: number): void {
  grid.entries.push({ width, x, y });
}

function traceStreamline(
  field: VectorField,
  seedX: number,
  seedY: number,
  step: number,
  streamSettings: StreamSettings,
  separation: number,
  width: number,
  height: number,
  margin: number,
  strokeWidth: number,
  lengthScale: number,
): FlowStroke | null {
  if (
    seedX < margin ||
    seedY < margin ||
    seedX > width - margin ||
    seedY > height - margin
  ) {
    return null;
  }

  const centerSample = field.sample(seedX, seedY);
  const targetLength = computeStrokeLength(
    centerSample.speed,
    0.15,
    streamSettings.lengthContrast,
    streamSettings.lengthMin,
    streamSettings.lengthMax,
    lengthScale,
  );
  const points: { x: number; y: number }[] = [{ x: seedX, y: seedY }];
  const pointSpeeds: number[] = [centerSample.speed];
  const arcT: number[] = [0];
  let totalLength = 0;

  const integrate = (direction: 1 | -1) => {
    let x = seedX;
    let y = seedY;
    let segmentBudget = targetLength * 0.5;

    while (segmentBudget > 0) {
      const next = rk4Step(field, x, y, step, direction);
      if (
        next.x < margin ||
        next.y < margin ||
        next.x > width - margin ||
        next.y > height - margin
      ) {
        break;
      }
      const segLen = Math.hypot(next.x - x, next.y - y);
      if (segLen < 0.001) {
        break;
      }
      totalLength += segLen;
      segmentBudget -= segLen;
      const sample = field.sample(next.x, next.y);
      if (direction === 1) {
        points.push({ x: next.x, y: next.y });
        pointSpeeds.push(sample.speed);
        arcT.push(0);
      } else {
        points.unshift({ x: next.x, y: next.y });
        pointSpeeds.unshift(sample.speed);
        arcT.unshift(0);
      }
      x = next.x;
      y = next.y;
      if (totalLength >= targetLength) {
        break;
      }
    }
  };

  integrate(1);
  integrate(-1);

  if (points.length < MIN_STROKE_POINTS || totalLength < separation * 0.35) {
    return null;
  }

  let accumulated = 0;
  arcT[0] = 0;
  for (let i = 1; i < points.length; i += 1) {
    accumulated += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
    arcT[i] = accumulated / Math.max(0.001, totalLength);
  }

  return {
    arcT,
    pointSpeeds,
    points,
    sizeClass: "base",
    style: "line",
    thickness: strokeWidth,
  };
}

export type TraceStreamlinesOptions = {
  fieldSettings: VectorFieldSettings;
  markerStyle: FlowMarkerStyle;
  paletteSettings: FlowPaletteSettings;
  pathSettings: FlowPathSettings;
  seed: number;
  sizeVariety: number;
  streamSettings: StreamSettings;
  strokeWidth: number;
  width: number;
  height: number;
};

export function traceStreamlines({
  fieldSettings,
  height,
  markerStyle,
  paletteSettings,
  pathSettings,
  seed,
  sizeVariety,
  streamSettings,
  strokeWidth,
  width,
}: TraceStreamlinesOptions): FlowOutput {
  if (width <= 0 || height <= 0) {
    return { strokes: [] };
  }

  const field = createVectorField(width, height, fieldSettings, pathSettings);
  const separation = separationFromDensity(streamSettings.density, width, height);
  const step = 1.2 + (streamSettings.smoothness / 100) * 5.5;
  const margin = streamSettings.margin;
  const grid: OccupancyGrid = {
    cellSize: Math.max(8, separation * 0.5),
    entries: [],
  };

  const strokes: FlowStroke[] = [];
  const maxSeeds = Math.min(2400, Math.round((width * height) / (separation * separation) * 1.2));
  const cols = Math.max(2, Math.round(width / separation));
  const rows = Math.max(2, Math.round(height / separation));

  const trySeed = (seedX: number, seedY: number, attempt: number): void => {
    const sizeClass = sampleSizeClass(sizeVariety, seed + attempt * 17);
    const classWidth = strokeWidthForClass(strokeWidth, sizeClass);
    if (
      isTooClose(
        grid,
        seedX,
        seedY,
        classWidth,
        separation,
        streamSettings.spacingMode,
        streamSettings.gap,
      )
    ) {
      return;
    }
    const lengthScale = SIZE_CLASS_LENGTH_SCALE[sizeClass];
    const stroke = traceStreamline(
      field,
      seedX,
      seedY,
      step,
      streamSettings,
      separation,
      width,
      height,
      margin,
      classWidth,
      lengthScale,
    );
    if (!stroke) {
      return;
    }
    stroke.style = markerStyle;
    stroke.sizeClass = sizeClass;
    stroke.thickness = classWidth;
    stroke.colorHex = assignStrokeColor(
      stroke,
      paletteSettings,
      seed + attempt,
      height,
      strokes,
      seedX,
      seedY,
      separation * 1.8,
    );
    strokes.push(stroke);
    for (const point of stroke.points) {
      markOccupied(grid, point.x, point.y, classWidth);
    }
  };

  for (let attempt = 0; attempt < maxSeeds; attempt += 1) {
    const jitterX = (hash2(attempt, 0, seed) - 0.5) * separation * 0.35;
    const jitterY = (hash2(0, attempt, seed) - 0.5) * separation * 0.35;
    const col = attempt % cols;
    const row = Math.floor(attempt / cols) % rows;
    const seedX = (col + 0.5) * (width / cols) + jitterX;
    const seedY = (row + 0.5) * (height / rows) + jitterY;
    trySeed(seedX, seedY, attempt);
  }

  for (const stroke of strokes) {
    const mid = Math.floor(stroke.points.length / 2);
    const anchor = stroke.points[mid];
    if (!anchor) {
      continue;
    }
    const offset = separation * 0.92;
    const sample = field.sample(anchor.x, anchor.y);
    const nx = -Math.sin(sample.angle);
    const ny = Math.cos(sample.angle);
    trySeed(anchor.x + nx * offset, anchor.y + ny * offset, strokes.length + 1000);
    trySeed(anchor.x - nx * offset, anchor.y - ny * offset, strokes.length + 2000);
  }

  return { strokes };
}

export type BuildFlowOutputOptions = {
  fieldSettings: VectorFieldSettings;
  markerStyle: FlowMarkerStyle;
  paletteSettings: FlowPaletteSettings;
  pathSettings: FlowPathSettings;
  sizeVariety: number;
  streamSettings: StreamSettings;
  strokeWidth: number;
  width: number;
  height: number;
};

export function buildFlowOutput(
  width: number,
  height: number,
  fieldSettings: VectorFieldSettings,
  pathSettings: FlowPathSettings,
  streamSettings: StreamSettings,
  markerStyle: FlowMarkerStyle,
  strokeWidth: number,
  paletteSettings?: FlowPaletteSettings,
  sizeVariety = 0,
): FlowOutput {
  return traceStreamlines({
    fieldSettings,
    height,
    markerStyle,
    paletteSettings: paletteSettings ?? {
      assignmentMode: "weighted",
      customSlots: [],
      opacity: 100,
      presetId: "ocean",
    },
    pathSettings,
    seed: fieldSettings.seed,
    sizeVariety,
    streamSettings,
    strokeWidth,
    width,
  });
}

/** Minimum centerline distance between two strokes in packed mode (for tests). */
export function packedCollisionDistance(
  widthA: number,
  widthB: number,
  gap: number,
): number {
  return widthA * 0.5 + widthB * 0.5 + gap;
}
