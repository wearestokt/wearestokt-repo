/**
 * Flow field shared types and legacy helpers for the unified vector field engine.
 */

import { createVectorField, type FlowFieldPattern, type VectorFieldSettings } from "./flow-vector-field";

export type { FlowFieldPattern, TexturePreset, VectorFieldSettings } from "./flow-vector-field";
export { getFieldPresetPatch, getTexturePresetPatch } from "./flow-vector-field";
export type { FlowMarkerStyle, FlowOutput, FlowStroke, FlowTaper } from "./flow-streamline-math";
export { buildFlowOutput } from "./flow-streamline-math";

export type FlowFieldSettings = VectorFieldSettings;

/** @deprecated Streamlines replaced grid glyphs. */
export type FlowGlyph = {
  angle: number;
  lengthScale?: number;
  scale: number;
  x: number;
  y: number;
};

/** @deprecated Use streams.density via streamline tracing. */
export function resolveFlowGrid(
  width: number,
  height: number,
  density: number,
): { cols: number; rows: number } {
  const shortEdge = Math.max(1, Math.min(width, height));
  const spacing = shortEdge / Math.max(1, density);
  return {
    cols: Math.max(1, Math.round(width / spacing)),
    rows: Math.max(1, Math.round(height / spacing)),
  };
}

const LEGACY_SAMPLE_SIZE = 1920;

/** @deprecated Use createVectorField().sample() */
export function sampleFlowAngle(u: number, v: number, settings: FlowFieldSettings): number {
  const field = createVectorField(LEGACY_SAMPLE_SIZE, LEGACY_SAMPLE_SIZE, settings, {
    paths: [],
    reach: 0,
    smoothness: 72,
    strength: 0,
  });
  return field.sample(u * LEGACY_SAMPLE_SIZE, v * LEGACY_SAMPLE_SIZE).angle;
}

/** @deprecated Use createVectorField().sample() */
export function sampleFlowSpeed(u: number, v: number, settings: FlowFieldSettings): number {
  const field = createVectorField(LEGACY_SAMPLE_SIZE, LEGACY_SAMPLE_SIZE, settings, {
    paths: [],
    reach: 0,
    smoothness: 72,
    strength: 0,
  });
  return field.sample(u * LEGACY_SAMPLE_SIZE, v * LEGACY_SAMPLE_SIZE).speed;
}

/** @deprecated Streamlines replaced accent glyphs. */
export function buildFlowGlyphs(): FlowGlyph[] {
  return [];
}
