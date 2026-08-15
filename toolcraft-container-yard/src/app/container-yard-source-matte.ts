/**
 * Source matte for ASCII mode: alpha channel, edge-connected auto background removal,
 * and silhouette color cutout so interior empty holes are skipped too.
 */

import type { ContainerLayoutSlot } from "./container-yard-layout-types";
import type { PreparedSourceImage } from "./container-yard-image-sample";

export type ContainerMatteMode = "alpha" | "auto" | "both";

export type ContainerMatteStyle = "off" | ContainerMatteMode;

export type SourceMatteSettings = {
  alphaThreshold: number;
  enabled: boolean;
  invert: boolean;
  minCoverage: number;
  mode: ContainerMatteMode;
  tolerance: number;
};

export type PreparedSourceMatte = {
  height: number;
  subjectMask: Uint8Array;
  width: number;
};

function relativeLuminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function colorDistance(
  r: number,
  g: number,
  b: number,
  bgR: number,
  bgG: number,
  bgB: number,
): number {
  return Math.max(Math.abs(r - bgR), Math.abs(g - bgG), Math.abs(b - bgB));
}

function medianChannel(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

function estimateBorderBackgroundColor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { b: number; g: number; r: number } {
  const reds: number[] = [];
  const greens: number[] = [];
  const blues: number[] = [];

  const sample = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    reds.push(data[index] ?? 0);
    greens.push(data[index + 1] ?? 0);
    blues.push(data[index + 2] ?? 0);
  };

  for (let x = 0; x < width; x += 1) {
    sample(x, 0);
    sample(x, height - 1);
  }

  for (let y = 1; y < height - 1; y += 1) {
    sample(0, y);
    sample(width - 1, y);
  }

  return {
    b: medianChannel(blues),
    g: medianChannel(greens),
    r: medianChannel(reds),
  };
}

function toleranceToDistance(tolerance: number, scale = 1): number {
  const normalized = Math.min(100, Math.max(0, tolerance)) / 100;
  return Math.round(normalized * 96 * scale);
}

function isSilhouetteLikeSource(
  image: PreparedSourceImage,
  background: { b: number; g: number; r: number },
): boolean {
  const bgLuma = relativeLuminance(background.r, background.g, background.b);
  const brightBackground = bgLuma >= 0.78;
  const darkBackground = bgLuma <= 0.22;
  if (!brightBackground && !darkBackground) {
    return false;
  }

  const { data, height, width } = image;
  let opposite = 0;
  let total = 0;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 96));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;
      const luma = relativeLuminance(
        data[index] ?? 0,
        data[index + 1] ?? 0,
        data[index + 2] ?? 0,
      );
      total += 1;
      if (brightBackground && luma <= 0.45) {
        opposite += 1;
      } else if (darkBackground && luma >= 0.55) {
        opposite += 1;
      }
    }
  }

  return total > 0 && opposite / total >= 0.02;
}

function buildAutoBackgroundMask(
  image: PreparedSourceImage,
  background: { b: number; g: number; r: number },
  tolerance: number,
): Uint8Array {
  const { data, height, width } = image;
  const pixelCount = width * height;
  const backgroundMask = new Uint8Array(pixelCount);
  const visited = new Uint8Array(pixelCount);
  const maxDistance = toleranceToDistance(tolerance);
  const queue: number[] = [];

  const enqueueIfBackground = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    const index = y * width + x;
    if (visited[index]) {
      return;
    }

    const channelIndex = index * 4;
    const distance = colorDistance(
      data[channelIndex] ?? 0,
      data[channelIndex + 1] ?? 0,
      data[channelIndex + 2] ?? 0,
      background.r,
      background.g,
      background.b,
    );

    if (distance > maxDistance) {
      return;
    }

    visited[index] = 1;
    queue.push(index);
  };

  for (let x = 0; x < width; x += 1) {
    enqueueIfBackground(x, 0);
    enqueueIfBackground(x, height - 1);
  }

  for (let y = 0; y < height; y += 1) {
    enqueueIfBackground(0, y);
    enqueueIfBackground(width - 1, y);
  }

  while (queue.length > 0) {
    const index = queue.pop()!;
    backgroundMask[index] = 1;

    const x = index % width;
    const y = Math.floor(index / width);
    enqueueIfBackground(x - 1, y);
    enqueueIfBackground(x + 1, y);
    enqueueIfBackground(x, y - 1);
    enqueueIfBackground(x, y + 1);
  }

  return backgroundMask;
}

/**
 * For high-contrast silhouettes, treat ANY near-background pixel as empty —
 * including white holes completely enclosed by the subject.
 */
function buildSilhouetteEmptyMask(
  image: PreparedSourceImage,
  background: { b: number; g: number; r: number },
  tolerance: number,
): Uint8Array {
  const { data, height, width } = image;
  const emptyMask = new Uint8Array(width * height);
  const maxDistance = toleranceToDistance(tolerance, 1.45);
  const bgLuma = relativeLuminance(background.r, background.g, background.b);
  const brightBackground = bgLuma >= 0.78;
  const darkBackground = bgLuma <= 0.22;
  // Soft luma gate catches AA fringes and flat empty fills even when RGB drifts slightly.
  const lumaEmptyThreshold = brightBackground ? 0.72 : darkBackground ? 0.28 : -1;

  for (let index = 0; index < width * height; index += 1) {
    const channelIndex = index * 4;
    const r = data[channelIndex] ?? 0;
    const g = data[channelIndex + 1] ?? 0;
    const b = data[channelIndex + 2] ?? 0;
    const distance = colorDistance(r, g, b, background.r, background.g, background.b);
    const luma = relativeLuminance(r, g, b);
    const lumaEmpty =
      lumaEmptyThreshold >= 0 &&
      (brightBackground ? luma >= lumaEmptyThreshold : luma <= lumaEmptyThreshold);

    if (distance <= maxDistance || lumaEmpty) {
      emptyMask[index] = 1;
    }
  }

  return emptyMask;
}

function buildAlphaSubjectMask(
  image: PreparedSourceImage,
  alphaThreshold: number,
): Uint8Array {
  const { data, height, width } = image;
  const subjectMask = new Uint8Array(width * height);
  const threshold = Math.round((Math.min(100, Math.max(0, alphaThreshold)) / 100) * 255);

  for (let index = 0; index < width * height; index += 1) {
    const alpha = data[index * 4 + 3] ?? 0;
    subjectMask[index] = alpha >= threshold ? 255 : 0;
  }

  return subjectMask;
}

export function buildSourceMatteMask(
  image: PreparedSourceImage,
  settings: SourceMatteSettings,
): PreparedSourceMatte {
  const { height, width } = image;
  const pixelCount = width * height;
  const subjectMask = new Uint8Array(pixelCount);

  if (!settings.enabled) {
    subjectMask.fill(255);
    return { height, subjectMask, width };
  }

  const alphaMask =
    settings.mode === "auto"
      ? null
      : buildAlphaSubjectMask(image, settings.alphaThreshold);

  let floodMask: Uint8Array | null = null;
  let silhouetteMask: Uint8Array | null = null;

  if (settings.mode !== "alpha") {
    const background = estimateBorderBackgroundColor(image.data, width, height);
    floodMask = buildAutoBackgroundMask(image, background, settings.tolerance);
    if (isSilhouetteLikeSource(image, background)) {
      silhouetteMask = buildSilhouetteEmptyMask(image, background, settings.tolerance);
    }
  }

  for (let index = 0; index < pixelCount; index += 1) {
    const alphaPass = alphaMask ? alphaMask[index]! > 127 : true;
    const floodEmpty = floodMask ? floodMask[index]! === 1 : false;
    const silhouetteEmpty = silhouetteMask ? silhouetteMask[index]! === 1 : false;
    const autoPass = !(floodEmpty || silhouetteEmpty);
    const isSubject = alphaPass && autoPass;
    // Invert flips subject vs empty so black-on-white and white-on-black both work.
    subjectMask[index] = (settings.invert ? !isSubject : isSubject) ? 255 : 0;
  }

  return { height, subjectMask, width };
}

export function getBlockSubjectCoverage(
  matte: PreparedSourceMatte,
  slot: ContainerLayoutSlot,
  canvasWidth: number,
  canvasHeight: number,
): number {
  const { height, subjectMask, width } = matte;
  const cx = slot.centerX;
  const cy = slot.centerY;
  const halfW = slot.width / 2;
  const halfH = slot.height / 2;
  const rad = (slot.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const startX = Math.max(0, Math.floor(slot.x));
  const startY = Math.max(0, Math.floor(slot.y));
  const endX = Math.min(canvasWidth - 1, Math.ceil(slot.x + slot.width));
  const endY = Math.min(canvasHeight - 1, Math.ceil(slot.y + slot.height));

  if (startX > endX || startY > endY) {
    return 0;
  }

  let subject = 0;
  let total = 0;

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const px = x + 0.5 - cx;
      const py = y + 0.5 - cy;
      const localX = px * cos + py * sin;
      const localY = -px * sin + py * cos;
      if (Math.abs(localX) > halfW || Math.abs(localY) > halfH) {
        continue;
      }

      const sx = Math.min(width - 1, Math.max(0, Math.round((x / canvasWidth) * (width - 1))));
      const sy = Math.min(height - 1, Math.max(0, Math.round((y / canvasHeight) * (height - 1))));
      const index = sy * width + sx;
      total += 1;
      if ((subjectMask[index] ?? 0) > 127) {
        subject += 1;
      }
    }
  }

  return total > 0 ? subject / total : 0;
}

export function shouldSkipBlockForMatte(
  matte: PreparedSourceMatte | null,
  settings: SourceMatteSettings,
  slot: ContainerLayoutSlot,
  canvasWidth: number,
  canvasHeight: number,
): boolean {
  if (!settings.enabled || !matte) {
    return false;
  }

  const coverage = getBlockSubjectCoverage(matte, slot, canvasWidth, canvasHeight);
  return coverage < settings.minCoverage / 100;
}

export function normalizeMatteStyle(value: unknown): ContainerMatteStyle {
  if (value === "off" || value === "alpha" || value === "auto" || value === "both") {
    return value;
  }

  if (value === false || value === "false") {
    return "off";
  }

  return "both";
}

export function normalizeMatteMode(value: unknown): ContainerMatteMode {
  if (value === "alpha" || value === "auto" || value === "both") {
    return value;
  }

  return "both";
}
