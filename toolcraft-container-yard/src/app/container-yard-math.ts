/**
 * Pure container-yard pattern generation: rectangular/radial layout, dither, colors, draw.
 */

import { buildAsciiBlockLayout } from "./container-yard-ascii-layout";
import {
  blendHexColors,
  buildDitherImageColors,
  normalizeDitherAlgorithm,
  type DitherSettings,
} from "./container-yard-dither";
import type {
  BuildContainerYardOptions,
  ContainerCanvasBounds,
  ContainerLayoutSlot,
  ContainerRect,
  ContainerYardOutput,
  ContainerYardSettings,
} from "./container-yard-layout-types";
import { buildRadialLayout } from "./container-yard-radial-layout";
import { buildRectangularLayout } from "./container-yard-rectangular-layout";
import type { PreparedSourceImage } from "./container-yard-image-sample";
import {
  buildSourceMatteMask,
  normalizeMatteStyle,
  shouldSkipBlockForMatte,
  type PreparedSourceMatte,
  type SourceMatteSettings,
} from "./container-yard-source-matte";

export type {
  BuildContainerYardOptions,
  ContainerCanvasBounds,
  ContainerColorMode,
  ContainerDitherAlgorithm,
  ContainerLayout,
  ContainerLayoutType,
  ContainerMatteStyle,
  ContainerOrientation,
  ContainerRadialAlign,
  ContainerRect,
  ContainerStripeOrientation,
  ContainerWaveAxis,
  ContainerYardOutput,
  ContainerYardSettings,
  ContainerZoneAxis,
} from "./container-yard-layout-types";

export const DEFAULT_CONTAINER_COLORS = [
  "#FF835E",
  "#99C4DB",
  "#8DDDB4",
  "#EC80A4",
  "#FF835E",
  "#99C4DB",
  "#8DDDB4",
  "#EC80A4",
] as const;

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rotatePoint(
  x: number,
  y: number,
  cx: number,
  cy: number,
  radians: number,
): { x: number; y: number } {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

function rectCorners(rect: ContainerRect): { x: number; y: number }[] {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const radians = (rect.rotation * Math.PI) / 180;
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  const local = [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH },
  ];
  return local.map((point) =>
    rotatePoint(point.x + cx, point.y + cy, cx, cy, radians),
  );
}

function rectFullyInsideCanvas(
  rect: ContainerRect,
  width: number,
  height: number,
): boolean {
  return rectCorners(rect).every(
    (corner) =>
      corner.x >= 0 && corner.x <= width && corner.y >= 0 && corner.y <= height,
  );
}

function rectIntersectsCanvas(
  rect: ContainerRect,
  width: number,
  height: number,
): boolean {
  const corners = rectCorners(rect);
  if (
    corners.some(
      (corner) =>
        corner.x >= 0 && corner.x <= width && corner.y >= 0 && corner.y <= height,
    )
  ) {
    return true;
  }

  const center = {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
  return center.x >= 0 && center.x <= width && center.y >= 0 && center.y <= height;
}

function clampPaletteIndex(index: number, paletteLength: number): number {
  if (paletteLength <= 0) {
    return 0;
  }
  const normalized = index % paletteLength;
  return normalized < 0 ? normalized + paletteLength : normalized;
}

function resolveWavePaletteIndex(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  settings: ContainerYardSettings,
  paletteLength: number,
): number {
  const phase = (settings.seed % 1000) / 1000;
  let position = 0;

  if (settings.waveAxis === "row") {
    position = centerY / Math.max(1, height);
  } else if (settings.waveAxis === "column") {
    position = centerX / Math.max(1, width);
  } else {
    const radius = Math.hypot(width, height) / 2;
    position = Math.hypot(centerX - width / 2, centerY - height / 2) / Math.max(1, radius);
    position = Math.min(1, Math.max(0, position));
  }

  return clampPaletteIndex(
    Math.floor((position * settings.waveCycles + phase) * paletteLength),
    paletteLength,
  );
}

function resolveZonePaletteIndex(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  settings: ContainerYardSettings,
  paletteLength: number,
): number {
  const position =
    settings.zoneAxis === "horizontal"
      ? centerX / Math.max(1, width)
      : centerY / Math.max(1, height);
  const clamped = Math.min(0.999999, Math.max(0, position));
  const zoneIndex = Math.min(
    settings.zoneCount - 1,
    Math.floor(clamped * settings.zoneCount),
  );
  const zoneSlots = [
    settings.zone1Slot,
    settings.zone2Slot,
    settings.zone3Slot,
    settings.zone4Slot,
  ];
  const slot = zoneSlots[zoneIndex] ?? zoneIndex + 1;
  return clampPaletteIndex(slot - 1, paletteLength);
}

function resolveStripePaletteIndex(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  settings: ContainerYardSettings,
  paletteLength: number,
): number {
  const bands = Math.max(1, settings.stripeRepeat);
  const widthFraction = Math.min(100, Math.max(5, settings.stripeWidth)) / 100;
  const highlightIndex = clampPaletteIndex(settings.stripeColorSlot - 1, paletteLength);

  let coordinate = 0;
  let span = 0;

  if (settings.stripeOrientation === "horizontal") {
    coordinate = centerY;
    span = height;
  } else if (settings.stripeOrientation === "vertical") {
    coordinate = centerX;
    span = width;
  } else {
    coordinate = centerX + centerY;
    span = width + height;
  }

  const period = Math.max(1, span / bands);
  const phase = ((settings.seed % 997) / 997) * period;
  const positionInPeriod = ((coordinate + phase) % period + period) % period;
  const inStripe = positionInPeriod / period < widthFraction;

  if (inStripe) {
    return highlightIndex;
  }

  const bandIndex = Math.floor((coordinate + phase) / period);
  let fillIndex = clampPaletteIndex(bandIndex, paletteLength);
  if (fillIndex === highlightIndex && paletteLength > 1) {
    fillIndex = clampPaletteIndex(fillIndex + 1, paletteLength);
  }
  return fillIndex;
}

function patternNoise(cellX: number, cellY: number, seed: number): number {
  let hash = Math.imul(cellX ^ seed, 374761393);
  hash = Math.imul(hash ^ (hash >>> 13), 668265263);
  hash = (hash ^ (hash >>> 16)) >>> 0;
  return hash / 4294967296;
}

function resolveCheckerPaletteIndex(
  row: number,
  col: number,
  settings: ContainerYardSettings,
  paletteLength: number,
): number {
  const cellSize = Math.max(1, Math.round(settings.colorPatternStep));
  const cellRow = Math.floor(row / cellSize);
  const cellCol = Math.floor(col / cellSize);
  const phase = settings.seed % paletteLength;
  return clampPaletteIndex(cellRow + cellCol + phase, paletteLength);
}

function resolveQuadrantPaletteIndex(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  settings: ContainerYardSettings,
  paletteLength: number,
): number {
  const left = centerX < width / 2;
  const top = centerY < height / 2;
  const quadrantIndex = (top ? 0 : 2) + (left ? 0 : 1);
  const zoneSlots = [
    settings.zone1Slot,
    settings.zone2Slot,
    settings.zone3Slot,
    settings.zone4Slot,
  ];
  const slot = zoneSlots[quadrantIndex] ?? quadrantIndex + 1;
  return clampPaletteIndex(slot - 1, paletteLength);
}

function resolveRingPaletteIndex(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  settings: ContainerYardSettings,
  paletteLength: number,
): number {
  const maxRadius = Math.hypot(width, height) / 2;
  const distance = Math.hypot(centerX - width / 2, centerY - height / 2);
  const rings = Math.max(1, Math.round(settings.colorPatternStep));
  const phase = (settings.seed % 1000) / 1000;
  const normalized = Math.min(0.999999, distance / Math.max(1, maxRadius));
  return clampPaletteIndex(Math.floor(normalized * rings + phase * paletteLength), paletteLength);
}

function resolveClusterPaletteIndex(
  centerX: number,
  centerY: number,
  settings: ContainerYardSettings,
  paletteLength: number,
): number {
  const scale = Math.max(8, Math.round(settings.colorPatternStep) * 10);
  const cellX = Math.floor(centerX / scale);
  const cellY = Math.floor(centerY / scale);
  const noise = patternNoise(cellX, cellY, settings.seed);
  return clampPaletteIndex(Math.floor(noise * paletteLength), paletteLength);
}

function resolveChevronPaletteIndex(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  settings: ContainerYardSettings,
  paletteLength: number,
): number {
  const bands = Math.max(2, Math.round(settings.colorPatternStep));
  const phase = (settings.seed % 1000) / 1000;
  const u = centerX / Math.max(1, width);
  const v = centerY / Math.max(1, height);
  const zigzag = v * bands + u * 0.5 + phase;
  return clampPaletteIndex(Math.floor(zigzag * 2), paletteLength);
}

function resolveContainerColor(
  settings: ContainerYardSettings,
  row: number,
  col: number,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  palette: readonly string[],
  rng: () => number,
): string {
  const paletteLength = palette.length;
  let index = 0;

  switch (settings.colorMode) {
    case "wave":
      index = resolveWavePaletteIndex(centerX, centerY, width, height, settings, paletteLength);
      break;
    case "zones":
      index = resolveZonePaletteIndex(centerX, centerY, width, height, settings, paletteLength);
      break;
    case "stripes":
      index = resolveStripePaletteIndex(centerX, centerY, width, height, settings, paletteLength);
      break;
    case "checker":
      index = resolveCheckerPaletteIndex(row, col, settings, paletteLength);
      break;
    case "quadrants":
      index = resolveQuadrantPaletteIndex(centerX, centerY, width, height, settings, paletteLength);
      break;
    case "rings":
      index = resolveRingPaletteIndex(centerX, centerY, width, height, settings, paletteLength);
      break;
    case "clusters":
      index = resolveClusterPaletteIndex(centerX, centerY, settings, paletteLength);
      break;
    case "chevron":
      index = resolveChevronPaletteIndex(centerX, centerY, width, height, settings, paletteLength);
      break;
    default:
      index = Math.floor(rng() * paletteLength);
      break;
  }

  return palette[index] ?? palette[0] ?? DEFAULT_CONTAINER_COLORS[0]!;
}

export function isContainerYardDitherActive(settings: ContainerYardSettings): boolean {
  return settings.layoutType === "dither";
}

export function readSourceMatteSettings(settings: ContainerYardSettings): SourceMatteSettings {
  const style = normalizeMatteStyle(settings.matteStyle);

  return {
    alphaThreshold: 40,
    enabled: style !== "off",
    minCoverage: settings.matteMinCoverage,
    mode: style === "off" ? "both" : style,
    // Higher tolerance than the original 24 so soft AA on flat white/black empties still clear.
    tolerance: 42,
  };
}

export function buildSourceMatteForSettings(
  image: PreparedSourceImage,
  settings: ContainerYardSettings,
): PreparedSourceMatte | null {
  if (!isContainerYardDitherActive(settings) || normalizeMatteStyle(settings.matteStyle) === "off") {
    return null;
  }

  return buildSourceMatteMask(image, readSourceMatteSettings(settings));
}

export function applyGlobalScale(settings: ContainerYardSettings): ContainerYardSettings {
  const factor = settings.globalScale / 100;
  if (!Number.isFinite(factor) || factor === 1) {
    return settings;
  }

  return {
    ...settings,
    columnGap: settings.columnGap * factor,
    containerWidth: settings.containerWidth * factor,
    lengthLong: settings.lengthLong * factor,
    lengthShort: settings.lengthShort * factor,
    rowGap: settings.rowGap * factor,
  };
}

function buildLayoutSlots(
  width: number,
  height: number,
  settings: ContainerYardSettings,
  rng: () => number,
): ContainerLayoutSlot[] {
  if (settings.layoutType === "dither") {
    return buildAsciiBlockLayout(width, height, settings, rng);
  }

  const scaledSettings = applyGlobalScale(settings);

  if (scaledSettings.layoutType === "radial") {
    return buildRadialLayout(width, height, scaledSettings, rng);
  }
  return buildRectangularLayout(width, height, scaledSettings, rng);
}

function assignContainerColors(
  width: number,
  height: number,
  settings: ContainerYardSettings,
  slots: readonly ContainerLayoutSlot[],
  activeColors: readonly string[],
  rng: () => number,
  options?: BuildContainerYardOptions,
): ContainerRect[] {
  const ditherSettings: DitherSettings = {
    algorithm: normalizeDitherAlgorithm(settings.ditherAlgorithm),
    bias: settings.ditherBias,
    contrast: settings.ditherContrast,
    enabled: isContainerYardDitherActive(settings),
    invert: settings.ditherInvert,
    seed: settings.seed,
    strength: settings.ditherStrength,
  };

  const image = options?.imageData ?? null;
  const matteMask =
    options?.matteMask ??
    (image && normalizeMatteStyle(settings.matteStyle) !== "off"
      ? buildSourceMatteForSettings(image, settings)
      : null);
  const matteSettings = readSourceMatteSettings(settings);
  const useDither = ditherSettings.enabled && image !== null;
  const ditherColors =
    useDither && image
      ? buildDitherImageColors(
          ditherSettings,
          slots,
          image,
          width,
          height,
          activeColors,
        )
      : [];

  const containers: ContainerRect[] = [];

  slots.forEach((slot, index) => {
    if (
      useDither &&
      shouldSkipBlockForMatte(matteMask, matteSettings, slot, width, height)
    ) {
      return;
    }

    const proceduralColor = resolveContainerColor(
      settings,
      slot.row,
      slot.col,
      slot.centerX,
      slot.centerY,
      width,
      height,
      activeColors,
      rng,
    );

    let color = proceduralColor;

    if (useDither && image) {
      const imageColor = ditherColors[index] ?? proceduralColor;
      const mix = Math.min(1, Math.max(0, ditherSettings.strength / 100));

      if (ditherSettings.algorithm === "palette") {
        color =
          mix <= 0
            ? proceduralColor
            : mix >= 1
              ? imageColor
              : blendHexColors(proceduralColor, imageColor, mix);
      } else {
        color =
          mix >= 1 ? imageColor : mix <= 0 ? proceduralColor : blendHexColors(proceduralColor, imageColor, mix);
      }
    }

    const rect: ContainerRect = {
      color,
      height: slot.height,
      rotation: slot.rotation,
      width: slot.width,
      x: slot.x,
      y: slot.y,
    };

    const include = settings.containInCanvas
      ? rectFullyInsideCanvas(rect, width, height)
      : rectIntersectsCanvas(rect, width, height);

    if (include) {
      containers.push(rect);
    }
  });

  return containers;
}

export function buildContainerYard(
  width: number,
  height: number,
  settings: ContainerYardSettings,
  options?: BuildContainerYardOptions,
): ContainerYardOutput {
  const bounds: ContainerCanvasBounds = { height, width };
  const palette = settings.colors.slice(0, Math.max(1, settings.colorCount));
  const activeColors = palette.length > 0 ? palette : [DEFAULT_CONTAINER_COLORS[0]!];
  const rng = mulberry32(settings.seed);
  const slots = buildLayoutSlots(width, height, settings, rng);
  const containers = assignContainerColors(
    width,
    height,
    settings,
    slots,
    activeColors,
    rng,
    options,
  );

  return { bounds, containers };
}

export function applyCanvasClip(
  context: CanvasRenderingContext2D,
  bounds: ContainerCanvasBounds,
): void {
  context.beginPath();
  context.rect(0, 0, bounds.width, bounds.height);
  context.clip();
}

export function drawContainerRect(
  context: CanvasRenderingContext2D,
  rect: ContainerRect,
  options?: {
    fill?: string;
    shadow?: boolean;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    shadowOpacity?: number;
  },
): void {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  context.save();
  context.translate(cx, cy);
  context.rotate((rect.rotation * Math.PI) / 180);

  if (options?.shadow) {
    context.fillStyle = `rgba(0,0,0,${(options.shadowOpacity ?? 40) / 100})`;
    context.fillRect(
      -rect.width / 2 + (options.shadowOffsetX ?? 4),
      -rect.height / 2 + (options.shadowOffsetY ?? 4),
      rect.width,
      rect.height,
    );
  }

  context.fillStyle = options?.fill ?? rect.color;
  context.fillRect(-rect.width / 2, -rect.height / 2, rect.width, rect.height);
  context.restore();
}

export function drawContainerYard(
  context: CanvasRenderingContext2D,
  output: ContainerYardOutput,
  settings: ContainerYardSettings,
): void {
  context.save();
  if (!settings.containInCanvas) {
    applyCanvasClip(context, output.bounds);
  }
  for (const rect of output.containers) {
    if (settings.shadowEnabled) {
      drawContainerRect(context, rect, {
        shadow: true,
        shadowOffsetX: settings.shadowOffsetX,
        shadowOffsetY: settings.shadowOffsetY,
        shadowOpacity: settings.shadowOpacity,
      });
    }
    drawContainerRect(context, rect);
  }
  context.restore();
}

export type { PreparedSourceImage };
