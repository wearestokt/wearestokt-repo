/**
 * Brand palette and ink-driven color slot resolution for Word Tide.
 */

export const BRAND_COLORS = {
  capri: "#00C1EF",
  darkSlate: "#354852",
  deepTeal: "#053239",
  linen: "#F8F1E8",
  skyBlue: "#8BE5FF",
} as const;

export type ColorSettings = {
  color1: string;
  color2: string;
  color3: string;
  color4: string;
  /** Active palette slots 1..4. */
  count: number;
};

export const DEFAULT_COLOR_SETTINGS: ColorSettings = {
  color1: BRAND_COLORS.deepTeal,
  color2: BRAND_COLORS.darkSlate,
  color3: BRAND_COLORS.capri,
  color4: BRAND_COLORS.skyBlue,
  count: 1,
};

/** Maps ink 0 (light areas) .. 1 (dense ink) onto active color slots dark -> light. */
export function colorForInk(settings: ColorSettings, ink: number): string {
  const slots = [
    settings.color1,
    settings.color2,
    settings.color3,
    settings.color4,
  ].slice(0, clampCount(settings.count));

  if (slots.length === 0) {
    return DEFAULT_COLOR_SETTINGS.color1;
  }
  if (slots.length === 1) {
    return slots[0]!;
  }

  const t = Math.min(1, Math.max(0, ink));
  const index = Math.min(slots.length - 1, Math.floor(t * slots.length * 0.999999));
  return slots[index]!;
}

function clampCount(count: number): number {
  return Math.min(4, Math.max(1, Math.round(count)));
}
