/**
 * Tasteful one-click shuffle for art-grade exploration.
 */

import type { PalettePresetId } from "./flow-palette";
import type { FlowFieldPattern, SnapAngles } from "./flow-vector-field";
import type { SpacingMode } from "./flow-streamline-math";

export type ShufflePatch = {
  "color.palette": PalettePresetId;
  "flow.pattern": FlowFieldPattern;
  "flow.seed": number;
  "flow.snapAngles": SnapAngles;
  "streams.spacingMode": SpacingMode;
  "stroke.sizeVariety": number;
};

const SHUFFLE_PALETTES: PalettePresetId[] = [
  "ocean",
  "ember",
  "newsprint",
  "golden-hour",
  "neon",
  "monochrome",
  "ink",
  "pastel",
  "twilight",
];

const SHUFFLE_PATTERNS: FlowFieldPattern[] = [
  "currents",
  "vortex",
  "waves",
  "turbulent",
  "radial",
];

const SHUFFLE_SNAPS: SnapAngles[] = ["off", "off", "45", "60", "90"];

const SHUFFLE_SPACING: SpacingMode[] = ["even", "packed", "packed", "loose"];

function hashPick<T>(items: readonly T[], seed: number): T {
  const index = Math.abs(seed) % items.length;
  return items[index]!;
}

export function buildShufflePatch(seed: number): ShufflePatch {
  const nextSeed = (seed * 1_103_515_245 + 12_345) % 10_000;
  return {
    "color.palette": hashPick(SHUFFLE_PALETTES, nextSeed),
    "flow.pattern": hashPick(SHUFFLE_PATTERNS, nextSeed >> 3),
    "flow.seed": nextSeed,
    "flow.snapAngles": hashPick(SHUFFLE_SNAPS, nextSeed >> 5),
    "streams.spacingMode": hashPick(SHUFFLE_SPACING, nextSeed >> 7),
    "stroke.sizeVariety": 20 + ((nextSeed >> 9) % 61),
  };
}
