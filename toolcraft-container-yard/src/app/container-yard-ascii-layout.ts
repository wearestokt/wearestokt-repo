/**
 * Uniform block grid for ASCII/image-replication mode.
 * Grid Layout controls (gaps, rotation, stagger, random gaps) apply on top of the block field.
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
  rng: () => number,
): ContainerLayoutSlot[] {
  void rng;
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

  const diag = Math.hypot(width, height);
  const cols = Math.ceil(diag / pitchX) + 4;
  const rows = Math.ceil(diag / pitchY) + 4;
  const gridWidth = cols * pitchX - scaled.columnGap;
  const gridHeight = rows * pitchY - scaled.rowGap;
  const originX = width / 2 - gridWidth / 2 + scaled.offsetX;
  const originY = height / 2 - gridHeight / 2 + scaled.offsetY;
  const staggerShift = (scaled.stagger / 100) * pitchX;
  const slots: ContainerLayoutSlot[] = [];

  for (let row = 0; row < rows; row += 1) {
    const rowStagger = scaled.layout === "rows" && row % 2 === 1 ? staggerShift : 0;

    for (let col = 0; col < cols; col += 1) {
      const colStagger = scaled.layout === "columns" && col % 2 === 1 ? staggerShift : 0;

      if (scaled.randomGaps > 0) {
        let gapHash = Math.imul(col ^ scaled.seed, 374761393);
        gapHash = Math.imul(gapHash ^ row, 668265263);
        gapHash = (gapHash ^ (gapHash >>> 16)) >>> 0;
        if ((gapHash / 4294967296) * 100 < scaled.randomGaps) {
          continue;
        }
      }

      const x = originX + col * pitchX + rowStagger;
      const y = originY + row * pitchY + colStagger;

      if (x + blockWidth < 0 || y + blockHeight < 0 || x > width || y > height) {
        continue;
      }

      slots.push({
        centerX: x + blockWidth / 2,
        centerY: y + blockHeight / 2,
        col,
        height: blockHeight,
        rotation: scaled.rotation,
        row,
        width: blockWidth,
        x,
        y,
      });
    }
  }

  return slots;
}
