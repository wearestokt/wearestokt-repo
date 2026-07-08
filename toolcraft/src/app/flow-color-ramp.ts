/**
 * Color mapping for streamline strokes — palette-based (Flow Field 3.0).
 */

import type { FlowStroke } from "./flow-streamline-math";
import {
  colorForStroke,
  colorForStrokePointFromPalette,
  defaultFlowPaletteSettings,
  type FlowPaletteSettings,
  type PaletteAssignmentMode,
  type PalettePresetId,
  resolvePaletteColors,
  sampleWeightedColor,
} from "./flow-palette";

export type { FlowPaletteSettings, PaletteAssignmentMode, PalettePresetId };

/** @deprecated Use FlowPaletteSettings */
export type FlowColorSettings = FlowPaletteSettings;

/** @deprecated Use PaletteAssignmentMode */
export type ColorMapMode = PaletteAssignmentMode;

/** @deprecated Removed in 3.0 */
export type ColorMode = "flat" | "ramp";

export { defaultFlowPaletteSettings, resolvePaletteColors, sampleWeightedColor };

export function colorForStrokePoint(
  settings: FlowPaletteSettings,
  stroke: FlowStroke,
  index: number,
  canvasHeight: number,
): string {
  return colorForStrokePointFromPalette(stroke, index, settings, canvasHeight);
}

export function rgbaFromFlatColor(color: { hex: string; opacity: number }): string {
  const value = color.hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${color.opacity / 100})`;
}

export function strokeGradientStops(
  settings: FlowPaletteSettings,
  stroke: FlowStroke,
  canvasHeight: number,
): { color: string; offset: number }[] {
  const count = Math.min(8, Math.max(2, stroke.points.length));
  const stops: { color: string; offset: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.round((i / Math.max(1, count - 1)) * (stroke.points.length - 1));
    stops.push({
      color: colorForStrokePoint(settings, stroke, index, canvasHeight),
      offset: i / Math.max(1, count - 1),
    });
  }
  return stops;
}

export { colorForStroke };
