/**
 * Radial ring layout: containers on concentric rings with tangent or radial alignment.
 */

import type { ContainerLayoutSlot, ContainerYardSettings } from "./container-yard-layout-types";

export function buildRadialLayout(
  width: number,
  height: number,
  settings: ContainerYardSettings,
  rng: () => number,
): ContainerLayoutSlot[] {
  const slots: ContainerLayoutSlot[] = [];
  const centerX = width / 2 + settings.offsetX;
  const centerY = height / 2 + settings.offsetY;
  const faceWidth =
    settings.orientation === "vertical" ? settings.containerWidth : settings.lengthShort;
  const faceLength =
    settings.orientation === "vertical" ? settings.lengthShort : settings.containerWidth;
  const arcPitch = Math.max(1, faceWidth + settings.columnGap);
  const ringPitch = Math.max(1, faceLength + settings.rowGap);
  const maxRadius = Math.hypot(width, height) / 2 + ringPitch;

  let ringIndex = 0;
  let radius = ringPitch;

  while (radius < maxRadius) {
    const slotCount = Math.max(3, Math.floor((2 * Math.PI * radius) / arcPitch));
    const angularStagger =
      ringIndex % 2 === 1 ? ((settings.stagger / 100) * Math.PI) / slotCount : 0;

    for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
      if (settings.randomGaps > 0 && rng() * 100 < settings.randomGaps) {
        continue;
      }

      const useLong = rng() * 100 < settings.lengthMix;
      const length = useLong ? settings.lengthLong : settings.lengthShort;
      const rectWidth =
        settings.orientation === "vertical" ? settings.containerWidth : length;
      const rectHeight =
        settings.orientation === "vertical" ? length : settings.containerWidth;

      const theta = (slotIndex / slotCount) * 2 * Math.PI + angularStagger;
      const slotCenterX = centerX + radius * Math.cos(theta);
      const slotCenterY = centerY + radius * Math.sin(theta);

      const alignRad =
        settings.radialAlign === "tangent" ? theta + Math.PI / 2 : theta;
      const rotationDeg = (alignRad * 180) / Math.PI + settings.rotation;

      slots.push({
        centerX: slotCenterX,
        centerY: slotCenterY,
        col: slotIndex,
        height: rectHeight,
        rotation: rotationDeg,
        row: ringIndex,
        width: rectWidth,
        x: slotCenterX - rectWidth / 2,
        y: slotCenterY - rectHeight / 2,
      });
    }

    ringIndex += 1;
    radius += ringPitch;
  }

  return slots;
}
