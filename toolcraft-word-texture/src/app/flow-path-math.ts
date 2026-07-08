/**
 * Flow path geometry: Catmull-Rom splines, arc sampling, and overlay helpers.
 */

export type FlowPathPoint = { x: number; y: number };

export type FlowPath = {
  id: string;
  points: FlowPathPoint[];
};

export type FlowPathsState = {
  activePathId: string | null;
  paths: FlowPath[];
};

export type FlowPathSettings = {
  lengthContrast: number;
  paths: FlowPath[];
  reach: number;
  smoothness: number;
  strength: number;
  thickness: number;
};

export type PathArcSample = {
  curvature: number;
  pathId: string;
  tangentAngle: number;
  x: number;
  y: number;
};

const TURN_CURVATURE_THRESHOLD = Math.PI / 12;

function absAngleDelta(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
}

function catmullRomPoint(
  p0: FlowPathPoint,
  p1: FlowPathPoint,
  p2: FlowPathPoint,
  p3: FlowPathPoint,
  t: number,
): FlowPathPoint {
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

function catmullRomDerivative(
  p0: FlowPathPoint,
  p1: FlowPathPoint,
  p2: FlowPathPoint,
  p3: FlowPathPoint,
  t: number,
): FlowPathPoint {
  const t2 = t * t;
  return {
    x:
      0.5 *
      ((-p0.x + p2.x) +
        2 * (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t +
        3 * (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t2),
    y:
      0.5 *
      ((-p0.y + p2.y) +
        2 * (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t +
        3 * (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t2),
  };
}

function peakCurvatureAtIndex(
  arcs: readonly PathArcSample[],
  index: number,
  radius = 12,
): number {
  let peak = 0;
  const start = Math.max(0, index - radius);
  const end = Math.min(arcs.length - 1, index + radius);
  for (let i = start; i <= end; i += 1) {
    peak = Math.max(peak, arcs[i]!.curvature);
  }
  return peak;
}

/** Sample a path into arc points; smoothness controls subdivision density. */
export function samplePathArcs(path: FlowPath, smoothness: number): PathArcSample[] {
  const { points } = path;
  if (points.length < 2) {
    return [];
  }

  const samplesPerSegment = Math.max(16, Math.round(16 + (smoothness / 100) * 112));
  const raw: Omit<PathArcSample, "curvature">[] = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;

    for (let s = 0; s <= samplesPerSegment; s += 1) {
      const t = s / samplesPerSegment;
      const pt = catmullRomPoint(p0, p1, p2, p3, t);
      const deriv = catmullRomDerivative(p0, p1, p2, p3, t);
      raw.push({
        pathId: path.id,
        tangentAngle: Math.atan2(deriv.y, deriv.x),
        x: pt.x,
        y: pt.y,
      });
    }
  }

  if (raw.length === 0) {
    return [];
  }

  const arcs: PathArcSample[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const prev = raw[Math.max(0, i - 1)]!;
    const current = raw[i]!;
    const next = raw[Math.min(raw.length - 1, i + 1)]!;
    const turn = Math.max(
      absAngleDelta(prev.tangentAngle, current.tangentAngle),
      absAngleDelta(current.tangentAngle, next.tangentAngle),
    );
    arcs.push({
      ...current,
      curvature: Math.min(1, turn / TURN_CURVATURE_THRESHOLD),
    });
  }

  for (let i = 0; i < arcs.length; i += 1) {
    arcs[i] = {
      ...arcs[i]!,
      curvature: peakCurvatureAtIndex(arcs, i),
    };
  }

  return arcs;
}

export function getValidGuidePaths(paths: readonly FlowPath[]): FlowPath[] {
  return paths.filter((path) => path.points.length >= 2);
}

export function computeGuideProximity(distance: number, reachPx: number): number {
  if (reachPx <= 0) {
    return 0;
  }
  const x = Math.min(1, Math.max(0, 1 - distance / reachPx));
  return x * x * (3 - 2 * x);
}

export function buildPathSplinePathD(points: readonly FlowPathPoint[], smoothness: number): string {
  if (points.length < 2) {
    return "";
  }
  const samplesPerSegment = Math.max(16, Math.round(16 + (smoothness / 100) * 64));
  const parts: string[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    for (let s = 0; s <= samplesPerSegment; s += 1) {
      const t = s / samplesPerSegment;
      const pt = catmullRomPoint(p0, p1, p2, p3, t);
      parts.push(`${s === 0 && i === 0 ? "M" : "L"} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`);
    }
  }
  return parts.join(" ");
}

export function scalePathSettings(
  pathSettings: FlowPathSettings,
  fromWidth: number,
  fromHeight: number,
  toWidth: number,
  toHeight: number,
): FlowPathSettings {
  if (fromWidth === toWidth && fromHeight === toHeight) {
    return pathSettings;
  }
  const sx = toWidth / Math.max(1, fromWidth);
  const sy = toHeight / Math.max(1, fromHeight);
  return {
    ...pathSettings,
    paths: pathSettings.paths.map((path) => ({
      ...path,
      points: path.points.map((point) => ({ x: point.x * sx, y: point.y * sy })),
    })),
  };
}

export function createPathId(): string {
  return `path-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const defaultFlowPathsState: FlowPathsState = {
  activePathId: null,
  paths: [],
};

export const defaultFlowPathSettings: FlowPathSettings = {
  lengthContrast: 75,
  paths: [],
  reach: 45,
  smoothness: 72,
  strength: 55,
  thickness: 2.5,
};
