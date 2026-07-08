/**
 * Resolves the fontPicker value plus optional brand fonts into concrete
 * typography numbers the layout and renderers consume.
 */

import {
  getFontPickerFontById,
  type FontPickerValue,
} from "@/toolcraft/ui/components/controls/font-picker";

import { brandFontFaces, getBrandFontFamily, getBrandFontWeights } from "./brand-fonts";

const LETTER_SPACING_EM: Record<FontPickerValue["letterSpacing"], number> = {
  normal: 0,
  tight: -0.025,
  tighter: -0.05,
  wide: 0.025,
  wider: 0.05,
  widest: 0.1,
};

const LINE_HEIGHT_FACTOR: Record<FontPickerValue["lineHeight"], number> = {
  loose: 2,
  none: 1,
  normal: 1.5,
  relaxed: 1.625,
  snug: 1.375,
  tight: 1.25,
};

export type ResolvedTypography = {
  color: string;
  family: string;
  fontSize: number;
  letterSpacingEm: number;
  lineHeightFactor: number;
  opacity: number;
  textCase: FontPickerValue["textCase"];
  /** Weights available for the tone->weight ramp, ascending. */
  weights: number[];
  /** The picked (heaviest) weight. */
  weight: number;
};

const FALLBACK_STACK = `"IBM Plex Mono", ui-monospace, monospace`;

export function resolveTypography(font: FontPickerValue): ResolvedTypography {
  const entry = getFontPickerFontById(font.fontId);
  const brandFamily = getBrandFontFamily();
  const pickedWeight = clampWeight(Number.parseInt(font.fontWeight, 10) || 400);

  const family = brandFamily
    ? `"${brandFamily}", ${entry ? `"${entry.family}", ` : ""}${FALLBACK_STACK}`
    : entry
      ? `"${entry.family}", ${FALLBACK_STACK}`
      : FALLBACK_STACK;

  const catalogWeights = (entry?.weights ?? ["400"])
    .map((weight) => Number.parseInt(weight, 10))
    .filter((weight) => Number.isFinite(weight));
  const brandWeights = getBrandFontWeights();
  const weights = (brandWeights.length > 0 ? brandWeights : catalogWeights).sort(
    (a, b) => a - b,
  );

  return {
    color: font.color,
    family,
    fontSize: Math.max(4, font.fontSize),
    letterSpacingEm: LETTER_SPACING_EM[font.letterSpacing] ?? 0,
    lineHeightFactor: LINE_HEIGHT_FACTOR[font.lineHeight] ?? 1.5,
    opacity: Math.min(1, Math.max(0, font.opacity / 100)),
    textCase: font.textCase,
    weight: pickedWeight,
    weights: weights.length > 0 ? weights : [400],
  };
}

function clampWeight(weight: number): number {
  return Math.min(900, Math.max(100, weight));
}

/**
 * Tone->weight ramp: ink 1 keeps the picked weight, ink 0 drops toward the
 * lightest available weight. `range` (0..1) limits how far down the ramp may
 * travel; 0 disables the ramp entirely.
 */
export function weightForInk(
  typography: ResolvedTypography,
  ink: number,
  range: number,
): number {
  if (range <= 0) {
    return typography.weight;
  }

  const usable = typography.weights.filter((weight) => weight <= typography.weight);
  if (usable.length === 0) {
    return typography.weight;
  }

  const lightest = usable[0]!;
  const span = (typography.weight - lightest) * Math.min(1, Math.max(0, range));
  const target = typography.weight - span * (1 - Math.min(1, Math.max(0, ink)));

  let nearest = usable[0]!;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const weight of usable) {
    const distance = Math.abs(weight - target);
    if (distance < nearestDistance) {
      nearest = weight;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function buildCanvasFont(
  typography: ResolvedTypography,
  weight: number,
): string {
  return `${weight} ${typography.fontSize}px ${typography.family}`;
}

let brandFontLoadPromise: Promise<void> | null = null;

/** Registers configured brand font files with document.fonts (idempotent). */
export async function ensureBrandFontsLoaded(): Promise<void> {
  if (brandFontFaces.length === 0 || typeof document === "undefined") {
    return;
  }

  brandFontLoadPromise ??= Promise.all(
    brandFontFaces.map(async (face) => {
      const fontFace = new FontFace(face.family, `url("${face.url}")`, {
        weight: String(face.weight),
      });
      try {
        document.fonts.add(await fontFace.load());
      } catch {
        // Missing or invalid file: fall back to the picked catalog font.
      }
    }),
  ).then(() => undefined);

  await brandFontLoadPromise;
}
