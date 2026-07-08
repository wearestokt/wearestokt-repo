/**
 * Uniform block grid for ASCII/image-replication mode.
 * Each cell maps to one sampled image region without stagger, random gaps, or length mix.
 */

import type { ContainerLayoutSlot, ContainerYardSettings } from "./container-yard-layout-types";

function applyGlobalScale(settings: ContainerYardSettings): ContainerYardSettings {
  const factor = settings.globalScale / 100;
  if (!Number.isFinite(factor) || factor === 1) {
    return settings;
  }

  return {
    ...settings,
    columnGap: settings.columnGap * factor,
    containerWidth: settings.containerWidth * factor,
    lengthLong: settings.lengthLong * factor,
    lengthShort: settings.lengthShort * factor,
    rowGap: settings.rowGap * factor,
  };
}

export function buildAsciiBlockLayout(
  width: number,
  height: number,
  settings: ContainerYardSettings,
): ContainerLayoutSlot[] {
  const scaled = applyGlobalScale(settings);
  const blockWidth =
    scaled.orientation === "vertical" ? scaled.containerWidth : scaled.lengthShort;
  const blockHeight =
    scaled.orientation === "vertical" ? scaled.lengthShort : scaled.containerWidth;
  const pitchX = blockWidth + scaled.columnGap;
  const pitchY = blockHeight + scaled.rowGap;

  if (pitchX <= 0 || pitchY <= 0) {
    return [];
  }

  const cols = Math.ceil(width / pitchX) + 2;
  const rows = Math.ceil(height / pitchY) + 2;
  const gridWidth = cols * pitchX - scaled.columnGap;
  const gridHeight = rows * pitchY - scaled.rowGap;
  const originX = (width - gridWidth) / 2 + scaled.offsetX;
  const originY = (height - gridHeight) / 2 + scaled.offsetY;
  const slots: ContainerLayoutSlot[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = originX + col * pitchX;
      const y = originY + row * pitchY;

      if (x + blockWidth < 0 || y + blockHeight < 0 || x > width || y > height) {
        continue;
      }

      slots.push({
        centerX: x + blockWidth / 2,
        centerY: y + blockHeight / 2,
        col,
        height: blockHeight,
        rotation: 0,
        row,
        width: blockWidth,
        x,
        y,
      });
    }
  }

  return slots;
}
