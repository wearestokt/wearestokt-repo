/**
 * Rectangular grid layout with stagger, gaps, and canvas containment filtering.
 */

import type { ContainerLayoutSlot, ContainerYardSettings } from "./container-yard-layout-types";

export function buildRectangularLayout(
  width: number,
  height: number,
  settings: ContainerYardSettings,
  rng: () => number,
): ContainerLayoutSlot[] {
  const slots: ContainerLayoutSlot[] = [];

  const unitW =
    settings.orientation === "vertical" ? settings.containerWidth : settings.lengthShort;
  const unitH =
    settings.orientation === "vertical" ? settings.lengthShort : settings.containerWidth;
  const pitchX = unitW + settings.columnGap;
  const pitchY = unitH + settings.rowGap;

  const diag = Math.hypot(width, height);
  const cols = Math.ceil(diag / Math.max(1, pitchX)) + 4;
  const rows = Math.ceil(diag / Math.max(1, pitchY)) + 4;

  const originX = width / 2 - (cols * pitchX) / 2 + settings.offsetX;
  const originY = height / 2 - (rows * pitchY) / 2 + settings.offsetY;
  const staggerShift = (settings.stagger / 100) * pitchX;

  for (let row = 0; row < rows; row += 1) {
    const rowStagger = settings.layout === "rows" && row % 2 === 1 ? staggerShift : 0;

    for (let col = 0; col < cols; col += 1) {
      const colStagger = settings.layout === "columns" && col % 2 === 1 ? staggerShift : 0;

      if (settings.randomGaps > 0 && rng() * 100 < settings.randomGaps) {
        continue;
      }

      const useLong = rng() * 100 < settings.lengthMix;
      const length = useLong ? settings.lengthLong : settings.lengthShort;
      const rectWidth =
        settings.orientation === "vertical" ? settings.containerWidth : length;
      const rectHeight =
        settings.orientation === "vertical" ? length : settings.containerWidth;

      const centerX = originX + col * pitchX + rowStagger + pitchX / 2;
      const centerY = originY + row * pitchY + colStagger + pitchY / 2;

      slots.push({
        centerX,
        centerY,
        col,
        height: rectHeight,
        rotation: settings.rotation,
        row,
        width: rectWidth,
        x: originX + col * pitchX + rowStagger + (pitchX - rectWidth) / 2,
        y: originY + row * pitchY + colStagger + (pitchY - rectHeight) / 2,
      });
    }
  }

  return slots;
}
