/**
 * Pure flow-field generation shared by the live Canvas 2D preview and the PNG
 * export draw. Given a canvas size and the art-direction settings, it samples a
 * directional vector field and emits one glyph instance per grid cell. No DOM,
 * no canvas, no runtime imports so it can be unit-tested and reused verbatim by
 * the export path (preview/export parity).
 */

import {
  filterGlyphsByGuideMask,
  sampleBlendedFlowAngle,
  sampleGuidePathSegments,
  shouldApplyGuideMask,
  type FlowGuideSettings,
  type SampledGuideSegment,
} from "./flow-guide-math";

export type { FlowGuideSettings };

export type FlowFieldPattern = "currents" | "vortex" | "waves" | "turbulent";
export type FlowMarkerStyle = "wedge" | "arrow" | "line" | "dart";

export type FlowFieldSettings = {
  pattern: FlowFieldPattern;
  direction: number;
  frequency: number;
  swirl: number;
  turbulence: number;
  density: number;
  jitter: number;
  markerStyle: FlowMarkerStyle;
  markerLength: number;
  markerThickness: number;
};

export type FlowGlyph = {
  x: number;
  y: number;
  angle: number;
  scale: number;
  guideWeight?: number;
};

const TWO_PI = Math.PI * 2;
const DEG2RAD = Math.PI / 180;
const FIELD_SEED = 21;

function hash2(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix | 0, 374_761_393) + Math.imul(iy | 0, 668_265_263) + Math.imul(seed | 0, 0x9e_37_79_b1)) | 0;
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

function fbm(x: number, y: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let octave = 0; octave < 3; octave += 1) {
    sum += valueNoise(x * freq, y * freq, seed + octave * 101) * amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum;
}

/**
 * Sample the flow direction (radians) at a normalized coordinate. `u`/`v` are in
 * units of the field's longest edge so circular patterns stay circular across
 * non-square canvases.
 */
export function sampleFlowAngle(u: number, v: number, settings: FlowFieldSettings): number {
  const baseAngle = settings.direction * DEG2RAD;
  const freq = 0.6 + (settings.frequency / 100) * 4.5;
  const swirlAmt = settings.swirl / 100;
  const turbAmt = settings.turbulence / 100;
  const cx = u - 0.5;
  const cy = v - 0.5;
  let angle: number;

  switch (settings.pattern) {
    case "waves": {
      const phase = v * freq * TWO_PI + (fbm(u * freq, v * freq, FIELD_SEED) - 0.5) * 2;
      angle = baseAngle + Math.sin(phase) * 0.6 + swirlAmt * 0.6;
      break;
    }
    case "vortex": {
      const tangential = Math.atan2(cy, cx) + Math.PI / 2;
      angle = tangential + swirlAmt * 1.4 + baseAngle * 0.15;
      break;
    }
    case "turbulent": {
      const e = 0.001;
      const n1 = fbm((u + e) * freq, v * freq, FIELD_SEED);
      const n2 = fbm((u - e) * freq, v * freq, FIELD_SEED);
      const n3 = fbm(u * freq, (v + e) * freq, FIELD_SEED);
      const n4 = fbm(u * freq, (v - e) * freq, FIELD_SEED);
      const dx = (n3 - n4) / (2 * e);
      const dy = -(n1 - n2) / (2 * e);
      angle = Math.atan2(dy, dx) + baseAngle + swirlAmt * 1.2;
      break;
    }
    case "currents":
    default: {
      const meander = (fbm(u * freq, v * freq, FIELD_SEED) - 0.5) * 2;
      angle = baseAngle + meander * 1.2 + swirlAmt * Math.PI * 0.5;
      break;
    }
  }

  angle += (fbm(u * freq * 2 + 10, v * freq * 2 + 10, FIELD_SEED + 7) - 0.5) * turbAmt * Math.PI;
  return angle;
}

/**
 * Smooth 0..1 "speed" field used to vary marker length so the field reads like
 * organic current data (longer where flow is strong) instead of a rigid grid.
 */
export function sampleFlowSpeed(u: number, v: number, settings: FlowFieldSettings): number {
  const freq = 0.6 + (settings.frequency / 100) * 4.5;
  const speed = 0.4 + 0.6 * fbm(u * freq + 5, v * freq + 5, FIELD_SEED + 3);
  return Math.min(1, Math.max(0, speed));
}

/**
 * Resolve the grid dimensions for a canvas size + density. `density` is the
 * approximate marker count along the short edge.
 */
export function resolveFlowGrid(
  width: number,
  height: number,
  density: number,
): { cols: number; rows: number } {
  const shortEdge = Math.max(1, Math.min(width, height));
  const spacing = shortEdge / Math.max(1, density);
  const cols = Math.max(1, Math.round(width / spacing));
  const rows = Math.max(1, Math.round(height / spacing));
  return { cols, rows };
}

/**
 * Build every glyph instance for a canvas. This is the "field-sample" pipeline
 * pass output: positions + angle + scale, with no styling baked in.
 */
export function buildFlowGlyphs(
  width: number,
  height: number,
  settings: FlowFieldSettings,
  guideSettings?: FlowGuideSettings,
): FlowGlyph[] {
  if (width <= 0 || height <= 0) {
    return [];
  }

  const { cols, rows } = resolveFlowGrid(width, height, settings.density);
  const stepX = width / cols;
  const stepY = height / rows;
  const maxDim = Math.max(width, height);
  const jitterAmt = settings.jitter / 100;
  const glyphs: FlowGlyph[] = [];
  const guides = guideSettings ?? { influence: 0, maskUninfluenced: false, paths: [], reach: 0 };
  const validGuidePaths = guides.paths.filter((path) => path.points.length >= 2);
  const guideSegments: SampledGuideSegment[] | undefined =
    validGuidePaths.length > 0
      ? validGuidePaths.flatMap((path) => sampleGuidePathSegments(path))
      : undefined;

  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const baseX = (i + 0.5) * stepX;
      const baseY = (j + 0.5) * stepY;
      const ox = (hash2(i, j, FIELD_SEED) * 2 - 1) * jitterAmt * stepX * 0.5;
      const oy = (hash2(i + 99, j + 33, FIELD_SEED) * 2 - 1) * jitterAmt * stepY * 0.5;
      const px = baseX + ox;
      const py = baseY + oy;
      const u = px / maxDim;
      const v = py / maxDim;
      const blended =
        guideSegments && guides.influence > 0 && guides.reach > 0
          ? sampleBlendedFlowAngle(
              px,
              py,
              u,
              v,
              settings,
              guides,
              width,
              height,
              guideSegments,
            )
          : { angle: sampleFlowAngle(u, v, settings), guideWeight: 0 };
      const speed = sampleFlowSpeed(u, v, settings);
      glyphs.push({
        angle: blended.angle,
        guideWeight: blended.guideWeight,
        scale: 0.55 + 0.45 * speed,
        x: px,
        y: py,
      });
    }
  }

  if (shouldApplyGuideMask(guides)) {
    return filterGlyphsByGuideMask(glyphs);
  }

  return glyphs;
}
