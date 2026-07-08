/**
 * Shared ink pipeline: image luminance -> ink density -> skip / opacity /
 * weight decisions used by both grid and flow layouts.
 */

import type { InkSettings } from "./word-layout-types";
import {
  inkFromLuminance,
  luminanceOverRect,
  type PreparedSourceImage,
} from "./word-source-sample";

/**
 * Ink density 0..1 for a word rect. Without an image the caller supplies a
 * fallback (per-slot noise) so fade, weight range, and sparsity stay active
 * on pure typographic textures; contrast/invert reshape that fallback too.
 */
export function computeWordInk(
  image: PreparedSourceImage | null,
  x: number,
  y: number,
  width: number,
  height: number,
  ink: InkSettings,
  fallbackInk: number,
): number {
  if (!image) {
    return inkFromLuminance(1 - fallbackInk, ink.contrast, ink.invert);
  }
  const luminance = luminanceOverRect(image, x, y, width, height);
  return inkFromLuminance(luminance, ink.contrast, ink.invert);
}

/**
 * Raw luminance 0..1 for zone banding (unaffected by invert). Without an
 * image, bands follow canvas height: light at the top, dark at the bottom.
 */
export function zoneLuminance(
  image: PreparedSourceImage | null,
  x: number,
  y: number,
  width: number,
  height: number,
  canvasHeight: number,
): number {
  if (!image) {
    return 1 - Math.min(1, Math.max(0, y / Math.max(1, canvasHeight)));
  }
  return luminanceOverRect(image, x, y, width, height);
}

/**
 * Sparsity thins light areas first: at full sparsity light slots always drop
 * out while dark slots mostly survive, so uniform textures thin gently.
 */
export function sparsitySkipsWord(
  inkValue: number,
  sparsity: number,
  roll: number,
): boolean {
  if (sparsity <= 0) {
    return false;
  }
  const skipProbability = (sparsity / 100) * (1 - inkValue * 0.85);
  return roll < skipProbability;
}

export function opacityForInk(inkValue: number, ink: InkSettings): number {
  if (!ink.fade) {
    return 1;
  }
  return 0.08 + 0.92 * Math.min(1, Math.max(0, inkValue));
}
