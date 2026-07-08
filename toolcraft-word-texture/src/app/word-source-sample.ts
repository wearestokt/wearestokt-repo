/**
 * Source-image luminance sampling for word slots. The prepared image is a
 * cover/cropped canvas-size ImageData buffer, so slot coordinates map 1:1.
 */

export type PreparedSourceImage = {
  data: Uint8ClampedArray;
  height: number;
  width: number;
};

export function luminanceAtPoint(
  image: PreparedSourceImage,
  x: number,
  y: number,
): number {
  const { data, width, height } = image;
  const sx = Math.min(width - 1, Math.max(0, Math.round(x)));
  const sy = Math.min(height - 1, Math.max(0, Math.round(y)));
  const index = (sy * width + sx) * 4;
  const r = data[index] ?? 0;
  const g = data[index + 1] ?? 0;
  const b = data[index + 2] ?? 0;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Average luminance over an axis-aligned word rect, sampled on a sparse grid
 * so wide words stay cheap (at most ~5x3 probes per word).
 */
export function luminanceOverRect(
  image: PreparedSourceImage,
  x: number,
  y: number,
  rectWidth: number,
  rectHeight: number,
): number {
  const columns = Math.min(5, Math.max(1, Math.round(rectWidth / 24)));
  const rows = Math.min(3, Math.max(1, Math.round(rectHeight / 16)));
  let sum = 0;
  let count = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const px = x + ((column + 0.5) / columns) * rectWidth;
      const py = y + ((row + 0.5) / rows) * rectHeight;
      sum += luminanceAtPoint(image, px, py);
      count += 1;
    }
  }

  return count > 0 ? sum / count : 0.5;
}

/**
 * After Effects-style input levels: crush shadows/highlights and steepen
 * midtones. `contrast` -100..100; 0 leaves luminance unchanged.
 */
export function applySourceLevels(luminance: number, contrast: number): number {
  const clamped = Math.min(1, Math.max(0, luminance));
  const amount = Math.max(-1, Math.min(1, contrast / 100));

  if (amount === 0) {
    return clamped;
  }

  if (amount > 0) {
    const crush = amount * (0.22 + amount * 0.33);
    const inputBlack = crush * 0.5;
    const inputWhite = 1 - crush * 0.5;
    const span = inputWhite - inputBlack;
    let value = span > 0.001 ? (clamped - inputBlack) / span : 0.5;
    value = Math.min(1, Math.max(0, value));
    const gamma = 1 / (1 + amount * 2.75);
    return Math.pow(value, gamma);
  }

  const lift = -amount;
  const gamma = 1 + lift * 1.15;
  let value = Math.pow(clamped, gamma);
  value = value * (1 - lift * 0.75) + 0.5 * lift * 0.75;
  return Math.min(1, Math.max(0, value));
}

export function applyToneCurve(
  luminance: number,
  contrast: number,
  invert: boolean,
): number {
  let value = applySourceLevels(luminance, contrast);
  if (invert) {
    value = 1 - value;
  }
  return value;
}

/**
 * Ink is the amount of pigment a slot receives: dark image areas produce
 * dense ink (1), light areas fade to 0. `invert` flips the reading for
 * light-on-dark sources.
 */
export function inkFromLuminance(
  luminance: number,
  contrast: number,
  invert: boolean,
): number {
  return 1 - applyToneCurve(luminance, contrast, invert);
}
