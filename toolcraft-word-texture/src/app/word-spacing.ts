/**
 * Luminance-driven grid spacing bias — mirrors tone-zone band logic but scales
 * word/row gaps instead of vocabulary.
 */

/** Gap multiplier 0.25..1 from luminance, bias direction, and range strength. */
export function luminanceGapMultiplier(
  luminance: number,
  bias: number,
  range: number,
): number {
  const rangeNorm = Math.min(1, Math.max(0, range / 100));
  if (rangeNorm <= 0 || bias === 0) {
    return 1;
  }

  const luminanceNorm = Math.min(1, Math.max(0, luminance));
  const biasNorm = Math.min(1, Math.max(-1, bias / 100));

  if (biasNorm < 0) {
    const darkAmount = 1 - luminanceNorm;
    return Math.max(0.25, 1 - rangeNorm * -biasNorm * darkAmount);
  }

  return Math.max(0.25, 1 - rangeNorm * biasNorm * luminanceNorm);
}

/** Horizontal cursor advance: tone spacing scales width+gap; overlap packs further in dark ink. */
export function horizontalWordAdvance(
  width: number,
  gap: number,
  gapMultiplier: number,
  ink: number,
  overlap: boolean,
): number {
  const baseAdvance = (width + Math.max(0, gap)) * gapMultiplier;
  if (!overlap) {
    return baseAdvance;
  }

  const darkAmount = Math.min(1, Math.max(0, (ink - 0.5) / 0.5));
  if (darkAmount <= 0) {
    return baseAdvance;
  }

  const overlapRatio = 0.12 + darkAmount * 0.58;
  const minAdvance = width * 0.28;
  return Math.max(minAdvance, baseAdvance * (1 - overlapRatio));
}

/** Row step from font size, literal gap, and luminance-driven tone spacing. */
export function verticalRowAdvance(
  fontSize: number,
  gap: number,
  gapMultiplier: number,
): number {
  return (fontSize + Math.max(0, gap)) * gapMultiplier;
}
