/**
 * Shape mask: converts an uploaded SVG or alpha-PNG (rasterized cover/crop at
 * canvas size) into a canvas-size alpha map that constrains word placement.
 */

import type { PreparedSourceImage } from "./word-source-sample";

export type ShapeMask = {
  alpha: Float32Array;
  height: number;
  width: number;
};

/**
 * Alpha source priority: real transparency when the image has any, otherwise
 * darkness (dark pixels = inside) so plain black-shape PNGs and SVGs work.
 */
export function buildShapeMask(
  image: PreparedSourceImage,
  invert: boolean,
  featherPx: number,
): ShapeMask {
  const { data, width, height } = image;
  const pixelCount = width * height;
  const alpha = new Float32Array(pixelCount);

  let hasTransparency = false;
  for (let index = 3; index < data.length; index += 4) {
    if ((data[index] ?? 255) < 250) {
      hasTransparency = true;
      break;
    }
  }

  for (let index = 0; index < pixelCount; index += 1) {
    const base = index * 4;
    let value: number;
    if (hasTransparency) {
      value = (data[base + 3] ?? 0) / 255;
    } else {
      const r = data[base] ?? 255;
      const g = data[base + 1] ?? 255;
      const b = data[base + 2] ?? 255;
      value = 1 - (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }
    alpha[index] = invert ? 1 - value : value;
  }

  const radius = Math.round(featherPx);
  if (radius > 0) {
    boxBlurInPlace(alpha, width, height, radius);
  }

  return { alpha, height, width };
}

export function maskAlphaAt(mask: ShapeMask, x: number, y: number): number {
  const sx = Math.min(mask.width - 1, Math.max(0, Math.round(x)));
  const sy = Math.min(mask.height - 1, Math.max(0, Math.round(y)));
  return mask.alpha[sy * mask.width + sx] ?? 0;
}

/**
 * A word is admitted only when every probe along its baseline sits inside the
 * mask (alpha >= 0.5), so words never get clipped by the shape edge. Returns
 * the minimum alpha for soft-edge fading, or null when rejected.
 */
export function maskAdmitsWord(
  mask: ShapeMask | null,
  x: number,
  y: number,
  wordWidth: number,
  angle: number,
): number | null {
  if (!mask) {
    return 1;
  }

  const probes = Math.max(2, Math.min(5, Math.ceil(wordWidth / 40) + 1));
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let minAlpha = 1;

  for (let probe = 0; probe < probes; probe += 1) {
    const distance = (probe / (probes - 1)) * wordWidth;
    const alpha = maskAlphaAt(mask, x + cos * distance, y + sin * distance);
    if (alpha < 0.5) {
      return null;
    }
    minAlpha = Math.min(minAlpha, alpha);
  }

  return minAlpha;
}

/** Two-pass separable box blur, run twice for a smooth feather. */
function boxBlurInPlace(
  alpha: Float32Array,
  width: number,
  height: number,
  radius: number,
): void {
  const scratch = new Float32Array(alpha.length);

  for (let pass = 0; pass < 2; pass += 1) {
    blurAxis(alpha, scratch, width, height, radius, true);
    blurAxis(scratch, alpha, width, height, radius, false);
  }
}

function blurAxis(
  source: Float32Array,
  target: Float32Array,
  width: number,
  height: number,
  radius: number,
  horizontal: boolean,
): void {
  const lines = horizontal ? height : width;
  const lineLength = horizontal ? width : height;
  const stride = horizontal ? 1 : width;
  const window = radius * 2 + 1;

  for (let line = 0; line < lines; line += 1) {
    const lineStart = horizontal ? line * width : line;
    let sum = 0;

    for (let offset = -radius; offset <= radius; offset += 1) {
      const clamped = Math.min(lineLength - 1, Math.max(0, offset));
      sum += source[lineStart + clamped * stride] ?? 0;
    }

    for (let position = 0; position < lineLength; position += 1) {
      target[lineStart + position * stride] = sum / window;

      const leaving = Math.max(0, position - radius);
      const entering = Math.min(lineLength - 1, position + radius + 1);
      sum -= source[lineStart + leaving * stride] ?? 0;
      sum += source[lineStart + entering * stride] ?? 0;
    }
  }
}
