/**
 * Unified vector field: seeded procedural patterns, curl-noise turbulence,
 * path-attractor blending, snap angles, and radial/spiral modes.
 */

import {
  computeGuideProximity,
  getValidGuidePaths,
  samplePathArcs,
  type FlowPath,
  type FlowPathSettings,
  type PathArcSample,
} from "./flow-path-math";

export type FlowFieldPattern = "currents" | "radial" | "turbulent" | "vortex" | "waves";
export type SnapAngles = "off" | "45" | "60" | "90";
export type TexturePreset = "calm" | "off" | "ripple" | "storm";

export type VectorFieldSettings = {
  direction: number;
  frequency: number;
  pattern: FlowFieldPattern;
  seed: number;
  snapAngles: SnapAngles;
  swirl: number;
  turbulence: number;
};

export type VectorFieldSample = {
  angle: number;
  speed: number;
};

const TWO_PI = Math.PI * 2;
const DEG2RAD = Math.PI / 180;

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

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const v00 = hash2(x0, y0, seed);
  const v10 = hash2(x0 + 1, y0, seed);
  const v01 = hash2(x0, y0 + 1, seed);
  const v11 = hash2(x0 + 1, y0 + 1, seed);
  const sx = smooth(fx);
  const sy = smooth(fy);
  const a = v00 + (v10 - v00) * sx;
  const b = v01 + (v11 - v01) * sx;
  return a + (b - a) * sy;
}

function fbm(x: number, y: number, seed: number, octaves = 3): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += valueNoise(x * freq, y * freq, seed + octave * 101) * amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum;
}

function slerpAngle(a: number, b: number, t: number): number {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + delta * t;
}

export function quantizeAngle(angle: number, snap: SnapAngles): number {
  if (snap === "off") {
    return angle;
  }
  const step = (Number.parseInt(snap, 10) * Math.PI) / 180;
  return Math.round(angle / step) * step;
}

function sampleProceduralAngle(u: number, v: number, settings: VectorFieldSettings): number {
  const baseAngle = settings.direction * DEG2RAD;
  const freq = 0.6 + (settings.frequency / 100) * 4.5;
  const swirlAmt = settings.swirl / 100;
  const seed = settings.seed | 0;
  const cx = u - 0.5;
  const cy = v - 0.5;
  let angle: number;

  switch (settings.pattern) {
    case "waves": {
      const phase = v * freq * TWO_PI + (fbm(u * freq, v * freq, seed) - 0.5) * 2;
      angle = baseAngle + Math.sin(phase) * 0.6 + swirlAmt * 0.6;
      break;
    }
    case "vortex": {
      const tangential = Math.atan2(cy, cx) + Math.PI / 2;
      angle = tangential + swirlAmt * 1.4 + baseAngle * 0.15;
      break;
    }
    case "radial": {
      const radial = Math.atan2(cy, cx);
      const spiral = radial + Math.PI / 2 + swirlAmt * 2.2 + (fbm(u * freq, v * freq, seed + 41) - 0.5) * 1.4;
      const blend = 0.55 + swirlAmt * 0.35;
      angle = radial * (1 - blend) + spiral * blend + baseAngle * 0.1;
      break;
    }
    case "turbulent": {
      const eps = 0.0015;
      const n = (x: number, y: number) => fbm(x * freq, y * freq, seed + 17, 4);
      const dx = (n(u + eps, v) - n(u - eps, v)) / (2 * eps);
      const dy = (n(u, v + eps) - n(u, v - eps)) / (2 * eps);
      angle = Math.atan2(dy, -dx) + baseAngle + swirlAmt * 0.8;
      break;
    }
    case "currents":
    default: {
      const meander = (fbm(u * freq, v * freq, seed) - 0.5) * 2;
      angle = baseAngle + meander * 1.2 + swirlAmt * Math.PI * 0.5;
      break;
    }
  }

  const turbAmt = settings.turbulence / 100;
  angle +=
    (fbm(u * freq * 2 + 10, v * freq * 2 + 10, seed + 7, 2) - 0.5) * turbAmt * Math.PI;
  return quantizeAngle(angle, settings.snapAngles);
}

function sampleProceduralSpeed(u: number, v: number, settings: VectorFieldSettings): number {
  const freq = 0.6 + (settings.frequency / 100) * 4.5;
  const speed = 0.35 + 0.65 * fbm(u * freq + 5, v * freq + 5, settings.seed + 3, 3);
  return Math.min(1, Math.max(0.05, speed));
}

type ArcSpatialIndex = {
  bucketSize: number;
  buckets: Map<string, PathArcSample[]>;
  reachPx: number;
  strength: number;
};

function bucketKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

function buildArcSpatialIndex(
  arcs: readonly PathArcSample[],
  reachPx: number,
  strength: number,
  bucketSize: number,
): ArcSpatialIndex {
  const buckets = new Map<string, PathArcSample[]>();
  for (const arc of arcs) {
    const cx = Math.floor(arc.x / bucketSize);
    const cy = Math.floor(arc.y / bucketSize);
    const key = bucketKey(cx, cy);
    const list = buckets.get(key) ?? [];
    list.push(arc);
    buckets.set(key, list);
  }
  return { bucketSize, buckets, reachPx, strength };
}

function nearestArcInIndex(
  index: ArcSpatialIndex,
  x: number,
  y: number,
): { arc: PathArcSample; distance: number } | null {
  if (index.buckets.size === 0) {
    return null;
  }
  const cx = Math.floor(x / index.bucketSize);
  const cy = Math.floor(y / index.bucketSize);
  const searchRadius = Math.max(1, Math.ceil(index.reachPx / index.bucketSize));
  let bestArc: PathArcSample | null = null;
  let bestDistance = Infinity;

  for (let dy = -searchRadius; dy <= searchRadius; dy += 1) {
    for (let dx = -searchRadius; dx <= searchRadius; dx += 1) {
      const list = index.buckets.get(bucketKey(cx + dx, cy + dy));
      if (!list) {
        continue;
      }
      for (const arc of list) {
        const distance = Math.hypot(x - arc.x, y - arc.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestArc = arc;
        }
      }
    }
  }

  if (!bestArc) {
    return null;
  }
  return { arc: bestArc, distance: bestDistance };
}

export type VectorField = {
  height: number;
  sample: (x: number, y: number) => VectorFieldSample;
  width: number;
};

export function createVectorField(
  width: number,
  height: number,
  fieldSettings: VectorFieldSettings,
  pathSettings: Pick<FlowPathSettings, "paths" | "reach" | "smoothness" | "strength">,
): VectorField {
  const maxDim = Math.max(width, height, 1);
  const shortEdge = Math.max(1, Math.min(width, height));
  const reachPx = (pathSettings.reach / 100) * shortEdge * 1.5;
  const strengthNorm = Math.min(1, Math.max(0, pathSettings.strength / 100));

  const validPaths = getValidGuidePaths(pathSettings.paths);
  const allArcs = validPaths.flatMap((path) => samplePathArcs(path, pathSettings.smoothness));
  const bucketSize = Math.max(24, reachPx / 3);
  const arcIndex =
    allArcs.length > 0 ? buildArcSpatialIndex(allArcs, reachPx, strengthNorm, bucketSize) : null;

  const sample = (x: number, y: number): VectorFieldSample => {
    const u = x / maxDim;
    const v = y / maxDim;
    let angle = sampleProceduralAngle(u, v, fieldSettings);
    let speed = sampleProceduralSpeed(u, v, fieldSettings);

    if (arcIndex && strengthNorm > 0) {
      const nearest = nearestArcInIndex(arcIndex, x, y);
      if (nearest && nearest.distance <= arcIndex.reachPx) {
        const weight = computeGuideProximity(nearest.distance, arcIndex.reachPx) * strengthNorm;
        angle = quantizeAngle(
          slerpAngle(angle, nearest.arc.tangentAngle, weight),
          fieldSettings.snapAngles,
        );
        speed = Math.min(1, speed + weight * 0.45);
      }
    }

    return { angle, speed };
  };

  return { height, sample, width };
}

export type FieldPresetPatch = Partial<VectorFieldSettings> & {
  sizeVariety?: number;
  spacingGap?: number;
  spacingMode?: "even" | "loose" | "packed";
  streamsDensity?: number;
  streamsMargin?: number;
};

export function getFieldPresetPatch(preset: TexturePreset): FieldPresetPatch {
  switch (preset) {
    case "off":
      return {
        frequency: 8,
        seed: 21,
        sizeVariety: 0,
        spacingGap: 2,
        spacingMode: "loose",
        streamsDensity: 6,
        streamsMargin: 8,
        swirl: 0,
        turbulence: 0,
      };
    case "ripple":
      return {
        frequency: 32,
        seed: 21,
        sizeVariety: 35,
        spacingGap: 3,
        spacingMode: "packed",
        streamsDensity: 22,
        streamsMargin: 16,
        swirl: 18,
        turbulence: 20,
      };
    case "storm":
      return {
        frequency: 48,
        seed: 21,
        sizeVariety: 55,
        spacingGap: 1,
        spacingMode: "packed",
        streamsDensity: 28,
        streamsMargin: 12,
        swirl: 42,
        turbulence: 55,
      };
    case "calm":
    default:
      return {
        frequency: 14,
        seed: 21,
        sizeVariety: 15,
        spacingGap: 4,
        spacingMode: "even",
        streamsDensity: 16,
        streamsMargin: 24,
        swirl: 8,
        turbulence: 10,
      };
  }
}

/** @deprecated Use getFieldPresetPatch */
export const getTexturePresetPatch = getFieldPresetPatch;
