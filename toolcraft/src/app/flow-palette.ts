/**
 * Probabilistic palette engine for art-grade streamline coloring.
 */

import type { FlowStroke } from "./flow-streamline-math";

export type PalettePresetId =
  | "custom"
  | "ember"
  | "golden-hour"
  | "ink"
  | "monochrome"
  | "neon"
  | "newsprint"
  | "ocean"
  | "pastel"
  | "twilight";

export type PaletteAssignmentMode = "inheritance" | "speed" | "vertical" | "weighted";

export type PaletteColorSlot = {
  hex: string;
  weight: number;
};

export type PaletteDefinition = {
  background: string;
  colors: PaletteColorSlot[];
  id: PalettePresetId;
  label: string;
};

export type FlowPaletteSettings = {
  assignmentMode: PaletteAssignmentMode;
  customSlots: PaletteColorSlot[];
  opacity: number;
  presetId: PalettePresetId;
};

export const CUSTOM_SLOT_COUNT = 5;

export const PRESET_PALETTES: readonly PaletteDefinition[] = [
  {
    background: "#0A1E3D",
    colors: [
      { hex: "#1B3A6B", weight: 28 },
      { hex: "#2E6B9E", weight: 24 },
      { hex: "#4DA6FF", weight: 22 },
      { hex: "#8FD4FF", weight: 16 },
      { hex: "#E8F4FF", weight: 10 },
    ],
    id: "ocean",
    label: "Ocean",
  },
  {
    background: "#1A0A05",
    colors: [
      { hex: "#FF4D1A", weight: 22 },
      { hex: "#FF8C42", weight: 24 },
      { hex: "#FFD166", weight: 20 },
      { hex: "#E85D4C", weight: 18 },
      { hex: "#5C1A0A", weight: 16 },
    ],
    id: "ember",
    label: "Ember",
  },
  {
    background: "#F2EDE4",
    colors: [
      { hex: "#1C1C1C", weight: 30 },
      { hex: "#4A4A4A", weight: 25 },
      { hex: "#8A8278", weight: 20 },
      { hex: "#C4BAA8", weight: 15 },
      { hex: "#E8E0D0", weight: 10 },
    ],
    id: "newsprint",
    label: "Newsprint",
  },
  {
    background: "#1A1208",
    colors: [
      { hex: "#FFB347", weight: 22 },
      { hex: "#FF6B35", weight: 24 },
      { hex: "#F7C59F", weight: 20 },
      { hex: "#D4A056", weight: 18 },
      { hex: "#8B4513", weight: 16 },
    ],
    id: "golden-hour",
    label: "Golden hour",
  },
  {
    background: "#050510",
    colors: [
      { hex: "#FF00FF", weight: 18 },
      { hex: "#00FFFF", weight: 22 },
      { hex: "#39FF14", weight: 20 },
      { hex: "#FF1493", weight: 20 },
      { hex: "#7B68EE", weight: 20 },
    ],
    id: "neon",
    label: "Neon",
  },
  {
    background: "#0D0D0D",
    colors: [
      { hex: "#FFFFFF", weight: 35 },
      { hex: "#CCCCCC", weight: 30 },
      { hex: "#888888", weight: 20 },
      { hex: "#444444", weight: 15 },
    ],
    id: "monochrome",
    label: "Monochrome",
  },
  {
    background: "#F8F4EC",
    colors: [
      { hex: "#1A1A1A", weight: 40 },
      { hex: "#3D3D3D", weight: 25 },
      { hex: "#6B6B6B", weight: 20 },
      { hex: "#A0A0A0", weight: 15 },
    ],
    id: "ink",
    label: "Ink",
  },
  {
    background: "#1A1028",
    colors: [
      { hex: "#C9B1FF", weight: 22 },
      { hex: "#FFB3D9", weight: 22 },
      { hex: "#B5EAD7", weight: 20 },
      { hex: "#FFDAC1", weight: 18 },
      { hex: "#E2F0CB", weight: 18 },
    ],
    id: "pastel",
    label: "Pastel",
  },
  {
    background: "#0F0A1E",
    colors: [
      { hex: "#4A2C82", weight: 24 },
      { hex: "#7B4FBF", weight: 22 },
      { hex: "#C77DFF", weight: 20 },
      { hex: "#3D5A80", weight: 18 },
      { hex: "#98C1D9", weight: 16 },
    ],
    id: "twilight",
    label: "Twilight",
  },
  {
    background: "#0A1E3D",
    colors: [{ hex: "#E8F4FF", weight: 100 }],
    id: "custom",
    label: "Custom",
  },
];

const DEFAULT_CUSTOM_SLOTS: PaletteColorSlot[] = [
  { hex: "#1B3A6B", weight: 25 },
  { hex: "#4DA6FF", weight: 25 },
  { hex: "#8FD4FF", weight: 20 },
  { hex: "#E8F4FF", weight: 20 },
  { hex: "#FFFFFF", weight: 10 },
];

export const defaultFlowPaletteSettings: FlowPaletteSettings = {
  assignmentMode: "weighted",
  customSlots: DEFAULT_CUSTOM_SLOTS,
  opacity: 100,
  presetId: "ocean",
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function hash01(seed: number): number {
  let h = (Math.imul(seed | 0, 1_103_515_245) + 12_345) | 0;
  h = (h ^ (h >>> 16)) | 0;
  h = Math.imul(h, 0x45d9f3b) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4_294_967_295;
}

export function getPresetPalette(id: PalettePresetId): PaletteDefinition {
  return PRESET_PALETTES.find((palette) => palette.id === id) ?? PRESET_PALETTES[0]!;
}

export function resolvePaletteColors(settings: FlowPaletteSettings): PaletteColorSlot[] {
  if (settings.presetId === "custom") {
    return settings.customSlots.slice(0, CUSTOM_SLOT_COUNT);
  }
  return getPresetPalette(settings.presetId).colors;
}

export function paletteBackgroundForSettings(settings: FlowPaletteSettings): string {
  if (settings.presetId === "custom") {
    return "#0A1E3D";
  }
  return getPresetPalette(settings.presetId).background;
}

export function normalizePaletteWeights(slots: readonly PaletteColorSlot[]): PaletteColorSlot[] {
  const total = slots.reduce((sum, slot) => sum + Math.max(0, slot.weight), 0);
  if (total <= 0) {
    return slots.map((slot) => ({ ...slot, weight: 100 / Math.max(1, slots.length) }));
  }
  return slots.map((slot) => ({ ...slot, weight: (Math.max(0, slot.weight) / total) * 100 }));
}

export function sampleWeightedColor(
  slots: readonly PaletteColorSlot[],
  random: number,
): string {
  const normalized = normalizePaletteWeights(slots);
  const target = clamp01(random) * 100;
  let cumulative = 0;
  for (const slot of normalized) {
    cumulative += slot.weight;
    if (target <= cumulative) {
      return slot.hex;
    }
  }
  return normalized[normalized.length - 1]?.hex ?? "#FFFFFF";
}

function hexToRgb(hex: string): { b: number; g: number; r: number } {
  const value = hex.replace("#", "");
  return {
    b: Number.parseInt(value.slice(4, 6), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    r: Number.parseInt(value.slice(0, 2), 16),
  };
}

export function rgbaFromHex(hex: string, opacity: number): string {
  const { b, g, r } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
}

function averageStrokeSpeed(stroke: FlowStroke): number {
  if (stroke.pointSpeeds.length === 0) {
    return 0.5;
  }
  return stroke.pointSpeeds.reduce((sum, speed) => sum + speed, 0) / stroke.pointSpeeds.length;
}

function strokeCenterY(stroke: FlowStroke): number {
  if (stroke.points.length === 0) {
    return 0;
  }
  return stroke.points.reduce((sum, point) => sum + point.y, 0) / stroke.points.length;
}

function nearestStrokeColor(
  strokes: readonly FlowStroke[],
  x: number,
  y: number,
  maxDistance: number,
): string | null {
  let best: { color: string; distance: number } | null = null;
  for (const stroke of strokes) {
    if (!stroke.colorHex) {
      continue;
    }
    const mid = stroke.points[Math.floor(stroke.points.length / 2)];
    if (!mid) {
      continue;
    }
    const distance = Math.hypot(mid.x - x, mid.y - y);
    if (distance <= maxDistance && (!best || distance < best.distance)) {
      best = { color: stroke.colorHex, distance };
    }
  }
  return best?.color ?? null;
}

export function assignStrokeColor(
  stroke: FlowStroke,
  settings: FlowPaletteSettings,
  seed: number,
  canvasHeight: number,
  existingStrokes: readonly FlowStroke[],
  seedX: number,
  seedY: number,
  neighborRadius: number,
): string {
  const slots = resolvePaletteColors(settings);
  const rng = hash01(seed ^ Math.round(seedX * 17) ^ Math.round(seedY * 31));

  switch (settings.assignmentMode) {
    case "inheritance": {
      const inherited = nearestStrokeColor(existingStrokes, seedX, seedY, neighborRadius);
      if (inherited && rng < 0.72) {
        return inherited;
      }
      return sampleWeightedColor(slots, hash01(seed + Math.round(seedX) + Math.round(seedY)));
    }
    case "speed": {
      const speedT = clamp01(averageStrokeSpeed(stroke));
      const biased = sampleWeightedColor(slots, speedT);
      return biased;
    }
    case "vertical": {
      const verticalT = clamp01(seedY / Math.max(1, canvasHeight));
      const shifted = clamp01(rng * 0.35 + verticalT * 0.65);
      return sampleWeightedColor(slots, shifted);
    }
    case "weighted":
    default:
      return sampleWeightedColor(slots, rng);
  }
}

export function colorForStroke(
  stroke: FlowStroke,
  settings: FlowPaletteSettings,
): string {
  const hex = stroke.colorHex ?? resolvePaletteColors(settings)[0]?.hex ?? "#FFFFFF";
  return rgbaFromHex(hex, settings.opacity);
}

export function parameterForStrokePoint(
  stroke: FlowStroke,
  index: number,
  mode: PaletteAssignmentMode,
  canvasHeight: number,
): number {
  switch (mode) {
    case "speed":
      return stroke.pointSpeeds[index] ?? 0.5;
    case "vertical": {
      const y = stroke.points[index]?.y ?? 0;
      return clamp01(y / Math.max(1, canvasHeight));
    }
    case "inheritance":
    case "weighted":
    default:
      return stroke.arcT[index] ?? index / Math.max(1, stroke.points.length - 1);
  }
}

export function colorForStrokePointFromPalette(
  stroke: FlowStroke,
  index: number,
  settings: FlowPaletteSettings,
  canvasHeight: number,
): string {
  if (settings.assignmentMode === "weighted" || settings.assignmentMode === "inheritance") {
    return colorForStroke(stroke, settings);
  }
  const slots = resolvePaletteColors(settings);
  const t = parameterForStrokePoint(stroke, index, settings.assignmentMode, canvasHeight);
  const hex = sampleWeightedColor(slots, t);
  return rgbaFromHex(hex, settings.opacity);
}
