/**
 * Image luminance sampling for container dither (cover/crop to canvas bounds).
 */

import type { ContainerLayoutSlot } from "./container-yard-layout-types";

export type PreparedSourceImage = {
  data: Uint8ClampedArray;
  height: number;
  width: number;
};

export function sampleRectCenterColor(
  image: PreparedSourceImage,
  slot: ContainerLayoutSlot,
  canvasWidth: number,
  canvasHeight: number,
): string {
  const { data, width, height } = image;
  const sx = Math.min(
    width - 1,
    Math.max(0, Math.round((slot.centerX / canvasWidth) * (width - 1))),
  );
  const sy = Math.min(
    height - 1,
    Math.max(0, Math.round((slot.centerY / canvasHeight) * (height - 1))),
  );
  const index = (sy * width + sx) * 4;
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, "0");

  return `#${channel(data[index] ?? 0)}${channel(data[index + 1] ?? 0)}${channel(data[index + 2] ?? 0)}`;
}

export function sampleRectAverageColor(
  image: PreparedSourceImage,
  slot: ContainerLayoutSlot,
  canvasWidth: number,
  canvasHeight: number,
): string {
  const cx = slot.centerX;
  const cy = slot.centerY;
  const halfW = slot.width / 2;
  const halfH = slot.height / 2;
  const rad = (slot.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;
  const { data, width, height } = image;

  const startX = Math.max(0, Math.floor(slot.x));
  const startY = Math.max(0, Math.floor(slot.y));
  const endX = Math.min(canvasWidth - 1, Math.ceil(slot.x + slot.width));
  const endY = Math.min(canvasHeight - 1, Math.ceil(slot.y + slot.height));

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      if (!pointInRotatedRect(x + 0.5, y + 0.5, cx, cy, halfW, halfH, cos, sin)) {
        continue;
      }

      const sx = Math.min(width - 1, Math.max(0, Math.round((x / canvasWidth) * (width - 1))));
      const sy = Math.min(height - 1, Math.max(0, Math.round((y / canvasHeight) * (height - 1))));
      const index = (sy * width + sx) * 4;
      sumR += data[index] ?? 0;
      sumG += data[index + 1] ?? 0;
      sumB += data[index + 2] ?? 0;
      count += 1;
    }
  }

  if (count === 0) {
    return "#808080";
  }

  const channel = (value: number) =>
    Math.round(value / count)
      .toString(16)
      .padStart(2, "0");

  return `#${channel(sumR)}${channel(sumG)}${channel(sumB)}`;
}

export function applyToneCurveToColor(
  hex: string,
  contrast: number,
  bias: number,
  invert: boolean,
): string {
  const normalized = hex.trim().replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const adjustedLuminance = applyToneCurve(luminance, contrast, bias, invert);
  const scale = luminance > 0 ? adjustedLuminance / luminance : adjustedLuminance;

  const channel = (value: number) =>
    Math.min(255, Math.max(0, Math.round(value * scale)))
      .toString(16)
      .padStart(2, "0");

  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function sampleRectAverageLuminance(
  image: PreparedSourceImage,
  slot: ContainerLayoutSlot,
  canvasWidth: number,
  canvasHeight: number,
): number {
  const cx = slot.centerX;
  const cy = slot.centerY;
  const halfW = slot.width / 2;
  const halfH = slot.height / 2;
  const rad = (slot.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const corners = [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH },
  ].map((point) => ({
    x: cx + point.x * cos - point.y * sin,
    y: cy + point.x * sin + point.y * cos,
  }));

  let minX = canvasWidth;
  let minY = canvasHeight;
  let maxX = 0;
  let maxY = 0;

  for (const corner of corners) {
    minX = Math.min(minX, corner.x);
    minY = Math.min(minY, corner.y);
    maxX = Math.max(maxX, corner.x);
    maxY = Math.max(maxY, corner.y);
  }

  const startX = Math.max(0, Math.floor(minX));
  const startY = Math.max(0, Math.floor(minY));
  const endX = Math.min(canvasWidth - 1, Math.ceil(maxX));
  const endY = Math.min(canvasHeight - 1, Math.ceil(maxY));

  if (startX > endX || startY > endY) {
    return 0.5;
  }

  let sum = 0;
  let count = 0;
  const { data, width, height } = image;

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      if (!pointInRotatedRect(x + 0.5, y + 0.5, cx, cy, halfW, halfH, cos, sin)) {
        continue;
      }

      const sx = Math.min(width - 1, Math.max(0, Math.round((x / canvasWidth) * (width - 1))));
      const sy = Math.min(height - 1, Math.max(0, Math.round((y / canvasHeight) * (height - 1))));
      const index = (sy * width + sx) * 4;
      const r = data[index] ?? 0;
      const g = data[index + 1] ?? 0;
      const b = data[index + 2] ?? 0;
      sum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      count += 1;
    }
  }

  return count > 0 ? sum / count : 0.5;
}

function pointInRotatedRect(
  px: number,
  py: number,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  cos: number,
  sin: number,
): boolean {
  const dx = px - cx;
  const dy = py - cy;
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;
  return Math.abs(localX) <= halfW && Math.abs(localY) <= halfH;
}

export function applyToneCurve(
  luminance: number,
  contrast: number,
  bias: number,
  invert: boolean,
): number {
  const contrastFactor = (contrast + 100) / 100;
  let value = (luminance - 0.5) * contrastFactor + 0.5 + bias / 100;
  value = Math.min(1, Math.max(0, value));
  if (invert) {
    value = 1 - value;
  }
  return value;
}
