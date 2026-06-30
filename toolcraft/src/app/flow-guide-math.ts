/**
 * Spline guide geometry and flow-field blending. Pure module shared by preview,
 * export, and unit tests.
 */

import {
  sampleFlowAngle,
  sampleFlowSpeed,
  type FlowFieldSettings,
  type FlowGlyph,
} from "./flow-field-math";

export type FlowGuidePoint = { x: number; y: number };

export type FlowGuidePath = {
  id: string;
  points: FlowGuidePoint[];
};

export type FlowGuidesState = {
  activePathId: string | null;
  paths: FlowGuidePath[];
};

export type FlowGuideSettings = {
  influence: number;
  maskUninfluenced: boolean;
  paths: FlowGuidePath[];
  reach: number;
};

export type GuideSampleResult = {
  distance: number;
  tangentAngle: number;
  weight: number;
};

export const GUIDE_WEIGHT_EPSILON = 0.02;
const SPLINE_SAMPLES_PER_SEGMENT = 12;

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function lerpAngle(from: number, to: number, t: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * t;
}

function catmullRomPoint(
  p0: FlowGuidePoint,
  p1: FlowGuidePoint,
  p2: FlowGuidePoint,
  p3: FlowGuidePoint,
  t: number,
): FlowGuidePoint {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

export type SampledGuideSegment = {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  pathId: string;
};

/** Sample a guide path into line segments for distance queries. */
export function sampleGuidePathSegments(path: FlowGuidePath): SampledGuideSegment[] {
  const { points } = path;
  if (points.length < 2) {
    return [];
  }

  const segments: SampledGuideSegment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;

    let prev = catmullRomPoint(p0, p1, p2, p3, 0);
    for (let s = 1; s <= SPLINE_SAMPLES_PER_SEGMENT; s += 1) {
      const t = s / SPLINE_SAMPLES_PER_SEGMENT;
      const next = catmullRomPoint(p0, p1, p2, p3, t);
      segments.push({
        ax: prev.x,
        ay: prev.y,
        bx: next.x,
        by: next.y,
        pathId: path.id,
      });
      prev = next;
    }
  }

  return segments;
}

function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { distance: number; tangentAngle: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-12) {
    return { distance: Math.hypot(px - ax, py - ay), tangentAngle: 0, t: 0 };
  }
  const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return {
    distance: Math.hypot(px - cx, py - cy),
    tangentAngle: Math.atan2(dy, dx),
    t,
  };
}

/** Paths with at least two points can influence the field. */
export function getValidGuidePaths(paths: readonly FlowGuidePath[]): FlowGuidePath[] {
  return paths.filter((path) => path.points.length >= 2);
}

function computeGuideWeight(
  distance: number,
  reachPx: number,
  influence: number,
): number {
  if (reachPx <= 0 || influence <= 0) {
    return 0;
  }
  const proximity = 1 - distance / reachPx;
  return influence * smoothstep(proximity);
}

/** Nearest guide influence at a canvas point. */
export function sampleGuideInfluence(
  px: number,
  py: number,
  guideSettings: FlowGuideSettings,
  canvasWidth: number,
  canvasHeight: number,
  segments?: readonly SampledGuideSegment[],
): GuideSampleResult {
  const validPaths = getValidGuidePaths(guideSettings.paths);
  if (validPaths.length === 0) {
    return { distance: Infinity, tangentAngle: 0, weight: 0 };
  }

  const shortEdge = Math.max(1, Math.min(canvasWidth, canvasHeight));
  const reachPx = (guideSettings.reach / 100) * shortEdge;
  const influence = guideSettings.influence / 100;
  const allSegments =
    segments ??
    validPaths.flatMap((path) => sampleGuidePathSegments(path));

  let bestDistance = Infinity;
  let bestTangent = 0;
  let bestWeight = 0;

  for (const segment of allSegments) {
    const { distance, tangentAngle } = distanceToSegment(
      px,
      py,
      segment.ax,
      segment.ay,
      segment.bx,
      segment.by,
    );
    const weight = computeGuideWeight(distance, reachPx, influence);
    if (weight > bestWeight) {
      bestWeight = weight;
      bestDistance = distance;
      bestTangent = tangentAngle;
    }
  }

  return { distance: bestDistance, tangentAngle: bestTangent, weight: bestWeight };
}

export function sampleBlendedFlowAngle(
  px: number,
  py: number,
  u: number,
  v: number,
  fieldSettings: FlowFieldSettings,
  guideSettings: FlowGuideSettings,
  canvasWidth: number,
  canvasHeight: number,
  segments?: readonly SampledGuideSegment[],
): { angle: number; guideWeight: number } {
  const baseAngle = sampleFlowAngle(u, v, fieldSettings);
  const guide = sampleGuideInfluence(
    px,
    py,
    guideSettings,
    canvasWidth,
    canvasHeight,
    segments,
  );
  if (guide.weight <= 0) {
    return { angle: baseAngle, guideWeight: 0 };
  }
  return {
    angle: lerpAngle(baseAngle, guide.tangentAngle, guide.weight),
    guideWeight: guide.weight,
  };
}

export function shouldApplyGuideMask(
  guideSettings: FlowGuideSettings,
): boolean {
  return guideSettings.maskUninfluenced && getValidGuidePaths(guideSettings.paths).length > 0;
}

export function filterGlyphsByGuideMask(glyphs: readonly FlowGlyph[]): FlowGlyph[] {
  return glyphs.filter((glyph) => (glyph.guideWeight ?? 0) >= GUIDE_WEIGHT_EPSILON);
}

/** Build SVG path d for preview overlay (Catmull-Rom through waypoints). */
export function buildGuideSplinePathD(points: readonly FlowGuidePoint[]): string {
  if (points.length < 2) {
    return "";
  }
  const parts: string[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    for (let s = 0; s <= SPLINE_SAMPLES_PER_SEGMENT; s += 1) {
      const t = s / SPLINE_SAMPLES_PER_SEGMENT;
      const pt = catmullRomPoint(p0, p1, p2, p3, t);
      parts.push(`${s === 0 && i === 0 ? "M" : "L"} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`);
    }
  }
  return parts.join(" ");
}

export function scaleGuideSettings(
  guideSettings: FlowGuideSettings,
  fromWidth: number,
  fromHeight: number,
  toWidth: number,
  toHeight: number,
): FlowGuideSettings {
  if (fromWidth === toWidth && fromHeight === toHeight) {
    return guideSettings;
  }
  const sx = toWidth / Math.max(1, fromWidth);
  const sy = toHeight / Math.max(1, fromHeight);
  return {
    ...guideSettings,
    paths: guideSettings.paths.map((path) => ({
      ...path,
      points: path.points.map((point) => ({ x: point.x * sx, y: point.y * sy })),
    })),
  };
}

export function createGuidePathId(): string {
  return `guide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const defaultFlowGuidesState: FlowGuidesState = {
  activePathId: null,
  paths: [],
};

export const defaultFlowGuideSettings: FlowGuideSettings = {
  influence: 70,
  maskUninfluenced: false,
  paths: [],
  reach: 30,
};

/** Re-export speed sampling for glyph build in flow-field-math integration. */
export { sampleFlowSpeed };
