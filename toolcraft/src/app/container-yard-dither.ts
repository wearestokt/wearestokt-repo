/**
 * Image block sampling for ASCII-style container replication.
 */

import type { ContainerDitherAlgorithm, ContainerLayoutSlot } from "./container-yard-layout-types";
import {
  applyToneCurve,
  applyToneCurveToColor,
  sampleRectAverageColor,
  sampleRectAverageLuminance,
  sampleRectCenterColor,
  type PreparedSourceImage,
} from "./container-yard-image-sample";

const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export type DitherSettings = {
  algorithm: ContainerDitherAlgorithm;
  bias: number;
  contrast: number;
  enabled: boolean;
  invert: boolean;
  seed: number;
  strength: number;
};

export function normalizeDitherAlgorithm(value: unknown): ContainerDitherAlgorithm {
  if (typeof value !== "string") {
    return "blocks";
  }

  switch (value) {
    case "blocks":
    case "palette":
    case "halftone":
    case "mono":
      return value;
    case "bayer4":
    case "bayer8":
    case "floyd-steinberg":
      return "halftone";
    case "threshold":
      return "mono";
    default:
      return "blocks";
  }
}

export function buildDitherImageColors(
  settings: DitherSettings,
  slots: readonly ContainerLayoutSlot[],
  image: PreparedSourceImage,
  canvasWidth: number,
  canvasHeight: number,
  palette: readonly string[],
): string[] {
  const algorithm = normalizeDitherAlgorithm(settings.algorithm);

  return slots.map((slot) => {
    const sampleColor =
      algorithm === "blocks" || algorithm === "palette"
        ? sampleRectCenterColor(image, slot, canvasWidth, canvasHeight)
        : sampleRectAverageColor(image, slot, canvasWidth, canvasHeight);
    const adjusted = applyToneCurveToColor(
      sampleColor,
      settings.contrast,
      settings.bias,
      settings.invert,
    );

    switch (algorithm) {
      case "blocks":
        return adjusted;

      case "palette":
        return seededPaletteColor(adjusted, palette, slot, settings.seed);

      case "mono": {
        const luminance = sampleRectAverageLuminance(image, slot, canvasWidth, canvasHeight);
        const tone = applyToneCurve(luminance, settings.contrast, settings.bias, settings.invert);
        const gray = Math.round(tone * 255)
          .toString(16)
          .padStart(2, "0");
        return `#${gray}${gray}${gray}`;
      }

      case "halftone":
      default: {
        const luminance = sampleRectAverageLuminance(image, slot, canvasWidth, canvasHeight);
        let tone = applyToneCurve(luminance, settings.contrast, settings.bias, settings.invert);
        tone += (BAYER_4[slot.row % 4]![slot.col % 4]! / 16 - 0.5) * 0.25;
        tone = Math.min(1, Math.max(0, tone));
        return blendHexColors("#000000", adjusted, tone);
      }
    }
  });
}

function blockSeedNoise(cellX: number, cellY: number, seed: number): number {
  let hash = Math.imul(cellX ^ seed, 374761393);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

function relativeLuminance(hex: string): number {
  const { b, g, r } = parseHex(hex);
  const sr = r / 255;
  const sg = g / 255;
  const sb = b / 255;
  return 0.2126 * sr + 0.7152 * sg + 0.0722 * sb;
}

function buildPalettePermutation(length: number, seed: number): number[] {
  const indices = Array.from({ length }, (_, index) => index);
  let state = seed >>> 0;

  const rng = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  for (let index = length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const current = indices[index]!;
    indices[index] = indices[swapIndex]!;
    indices[swapIndex] = current;
  }

  return indices;
}

function seededPaletteColor(
  hex: string,
  palette: readonly string[],
  slot: ContainerLayoutSlot,
  seed: number,
): string {
  if (palette.length === 0) {
    return hex;
  }

  if (palette.length === 1) {
    return palette[0]!;
  }

  const ordered = palette
    .map((color, index) => ({ color, luminance: relativeLuminance(color), index }))
    .sort((left, right) => left.luminance - right.luminance);
  const permutation = buildPalettePermutation(ordered.length, seed);
  const shuffledPalette = permutation.map((index) => ordered[index]!.color);

  const luminance = relativeLuminance(hex);
  const noise = (blockSeedNoise(slot.col, slot.row, seed) - 0.5) * 0.16;
  const adjusted = Math.min(0.999, Math.max(0, luminance + noise));
  const bin = Math.min(
    shuffledPalette.length - 1,
    Math.floor(adjusted * shuffledPalette.length),
  );

  return shuffledPalette[bin] ?? nearestPaletteColor(hex, palette);
}

function nearestPaletteColor(hex: string, palette: readonly string[]): string {
  if (palette.length === 0) {
    return hex;
  }

  const source = parseHex(hex);
  let best = palette[0]!;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of palette) {
    const target = parseHex(candidate);
    const distance =
      (source.r - target.r) ** 2 + (source.g - target.g) ** 2 + (source.b - target.b) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }

  return best;
}

function parseHex(hex: string): { b: number; g: number; r: number } {
  const normalized = hex.trim().replace("#", "");
  return {
    b: Number.parseInt(normalized.slice(4, 6), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    r: Number.parseInt(normalized.slice(0, 2), 16),
  };
}

export function blendHexColors(colorA: string, colorB: string, mixB: number): string {
  const a = parseHex(colorA);
  const b = parseHex(colorB);
  const t = Math.min(1, Math.max(0, mixB));
  const channel = (from: number, to: number) =>
    Math.round(from * (1 - t) + to * t)
      .toString(16)
      .padStart(2, "0");

  return `#${channel(a.r, b.r)}${channel(a.g, b.g)}${channel(a.b, b.b)}`;
}
