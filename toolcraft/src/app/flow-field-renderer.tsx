"use client";

import * as React from "react";

import { shouldIncludeToolcraftPreviewBackground } from "@/toolcraft/runtime";
import type { ToolcraftState } from "@/toolcraft/runtime";
import { useToolcraft } from "@/toolcraft/runtime/react";

import {
  buildFlowGlyphs,
  type FlowFieldSettings,
  type FlowGlyph,
  type FlowGuideSettings,
  type FlowMarkerStyle,
} from "./flow-field-math";
import {
  defaultFlowGuideSettings,
  scaleGuideSettings,
  type FlowGuidePath,
} from "./flow-guide-math";

export type FlowMarkerColor = {
  hex: string;
  opacity: number;
};

const defaultSettings: FlowFieldSettings = {
  density: 22,
  direction: 200,
  frequency: 28,
  jitter: 35,
  markerLength: 38,
  markerStyle: "wedge",
  markerThickness: 12,
  pattern: "currents",
  swirl: 30,
  turbulence: 24,
};

const defaultMarkerColor: FlowMarkerColor = { hex: "#FFFFFF", opacity: 100 };
const defaultBackgroundHex = "#3B5BE0";

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function asHex(value: unknown, fallback: string): string {
  if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())) {
    return value.trim();
  }
  if (value && typeof value === "object" && "hex" in value) {
    const hex = (value as { hex?: unknown }).hex;
    if (typeof hex === "string" && /^#[0-9a-f]{6}$/i.test(hex.trim())) {
      return hex.trim();
    }
  }
  return fallback;
}

/** Read art-direction settings from runtime state values. */
export function readFlowFieldSettings(state: ToolcraftState): FlowFieldSettings {
  const values = state.values;
  return {
    density: asNumber(values["field.density"], defaultSettings.density),
    direction: asNumber(values["flow.direction"], defaultSettings.direction),
    frequency: asNumber(values["flow.frequency"], defaultSettings.frequency),
    jitter: asNumber(values["field.jitter"], defaultSettings.jitter),
    markerLength: asNumber(values["marker.length"], defaultSettings.markerLength),
    markerStyle: asString<FlowMarkerStyle>(
      values["marker.style"],
      ["wedge", "arrow", "line", "dart"],
      defaultSettings.markerStyle,
    ),
    markerThickness: asNumber(values["marker.thickness"], defaultSettings.markerThickness),
    pattern: asString(
      values["flow.pattern"],
      ["currents", "vortex", "waves", "turbulent"] as const,
      defaultSettings.pattern,
    ),
    swirl: asNumber(values["flow.swirl"], defaultSettings.swirl),
    turbulence: asNumber(values["flow.turbulence"], defaultSettings.turbulence),
  };
}

export function readFlowMarkerColor(state: ToolcraftState): FlowMarkerColor {
  const raw = state.values["marker.color"];
  if (raw && typeof raw === "object") {
    const hex = asHex(raw, defaultMarkerColor.hex);
    const opacity = asNumber((raw as { opacity?: unknown }).opacity, defaultMarkerColor.opacity);
    return { hex, opacity: Math.min(100, Math.max(0, opacity)) };
  }
  return defaultMarkerColor;
}

export function readFlowBackgroundHex(state: ToolcraftState): string {
  return asHex(state.values["appearance.background"], defaultBackgroundHex);
}

function readGuidePaths(state: ToolcraftState): FlowGuidePath[] {
  const raw = state.values["guides.paths"];
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { paths?: unknown }).paths)) {
    return [];
  }
  return (raw as { paths: FlowGuidePath[] }).paths;
}

/** Read spline guide settings from runtime state values. */
export function readFlowGuideSettings(state: ToolcraftState): FlowGuideSettings {
  const paths = readGuidePaths(state);
  return {
    influence: asNumber(state.values["guides.influence"], defaultFlowGuideSettings.influence),
    maskUninfluenced:
      state.values["guides.maskUninfluenced"] === true,
    paths,
    reach: asNumber(state.values["guides.reach"], defaultFlowGuideSettings.reach),
  };
}

export function buildFlowGlyphsForState(
  width: number,
  height: number,
  state: ToolcraftState,
): FlowGlyph[] {
  const canvasWidth = state.canvas.size.width;
  const canvasHeight = state.canvas.size.height;
  const guideSettings = scaleGuideSettings(
    readFlowGuideSettings(state),
    canvasWidth,
    canvasHeight,
    width,
    height,
  );
  return buildFlowGlyphs(width, height, readFlowFieldSettings(state), guideSettings);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace("#", "");
  return {
    b: Number.parseInt(value.slice(4, 6), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    r: Number.parseInt(value.slice(0, 2), 16),
  };
}

function markerPath(
  context: CanvasRenderingContext2D,
  style: FlowMarkerStyle,
  length: number,
  thickness: number,
): void {
  const half = length / 2;
  const t = thickness / 2;

  switch (style) {
    case "line": {
      context.lineWidth = thickness;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(-half, 0);
      context.lineTo(half, 0);
      context.stroke();
      return;
    }
    case "arrow": {
      const headWidth = Math.max(thickness * 1.5, length * 0.18);
      const headBase = half - headWidth * 1.4;
      context.lineWidth = thickness;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(-half, 0);
      context.lineTo(headBase, 0);
      context.stroke();
      context.beginPath();
      context.moveTo(half, 0);
      context.lineTo(headBase, headWidth);
      context.lineTo(headBase, -headWidth);
      context.closePath();
      context.fill();
      return;
    }
    case "dart": {
      context.beginPath();
      context.moveTo(half, 0);
      context.lineTo(-half, t);
      context.lineTo(-half * 0.55, 0);
      context.lineTo(-half, -t);
      context.closePath();
      context.fill();
      return;
    }
    case "wedge":
    default: {
      context.beginPath();
      context.moveTo(half, 0);
      context.lineTo(-half, t);
      context.lineTo(-half, -t);
      context.closePath();
      context.fill();
      return;
    }
  }
}

export type DrawFlowFieldOptions = {
  width: number;
  height: number;
  settings: FlowFieldSettings;
  color: FlowMarkerColor;
  glyphs?: readonly FlowGlyph[];
};

/**
 * Shared rasterize pass. Draws the flow markers in CSS-pixel coordinate space
 * [0..width] × [0..height]. Used identically by the live preview and the PNG
 * export so output matches what the user sees.
 */
export function drawFlowField(
  context: CanvasRenderingContext2D,
  { color, glyphs, height, settings, width }: DrawFlowFieldOptions,
): void {
  const instances = glyphs ?? buildFlowGlyphs(width, height, settings);
  const { b, g, r } = hexToRgb(color.hex);
  const fill = `rgba(${r}, ${g}, ${b}, ${color.opacity / 100})`;

  context.save();
  context.fillStyle = fill;
  context.strokeStyle = fill;

  for (const glyph of instances) {
    context.save();
    context.translate(glyph.x, glyph.y);
    context.rotate(glyph.angle);
    markerPath(context, settings.markerStyle, settings.markerLength * glyph.scale, settings.markerThickness);
    context.restore();
  }

  context.restore();
}

/**
 * Live Canvas 2D preview. Renders into a backing store scaled by the runtime
 * render scale × device pixel ratio so the field stays crisp; zoom/pan are
 * handled by the canvas shell via CSS transform, so this never redraws on
 * viewport interactions.
 */
export function FlowFieldCanvas(): React.JSX.Element {
  const { state } = useToolcraft();
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const size = state.canvas.size;
  const settings = readFlowFieldSettings(state);
  const guideSettings = readFlowGuideSettings(state);
  const color = readFlowMarkerColor(state);
  const backgroundHex = readFlowBackgroundHex(state);
  const includeBackground = shouldIncludeToolcraftPreviewBackground({ state });
  const renderScale = asNumber(state.values["canvas.renderScale"], 1);

  const glyphs = React.useMemo(
    () => buildFlowGlyphsForState(size.width, size.height, state),
    [
      size.width,
      size.height,
      settings.pattern,
      settings.direction,
      settings.frequency,
      settings.swirl,
      settings.turbulence,
      settings.density,
      settings.jitter,
      guideSettings.influence,
      guideSettings.reach,
      guideSettings.maskUninfluenced,
      guideSettings.paths,
    ],
  );

  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    const scale = dpr * Math.max(1, renderScale);
    const backingWidth = Math.max(1, Math.round(size.width * scale));
    const backingHeight = Math.max(1, Math.round(size.height * scale));
    if (canvas.width !== backingWidth) {
      canvas.width = backingWidth;
    }
    if (canvas.height !== backingHeight) {
      canvas.height = backingHeight;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    if (includeBackground) {
      context.fillStyle = backgroundHex;
      context.fillRect(0, 0, size.width, size.height);
    }
    drawFlowField(context, { color, glyphs, height: size.height, settings, width: size.width });
  }, [
    glyphs,
    size.width,
    size.height,
    renderScale,
    includeBackground,
    backgroundHex,
    color.hex,
    color.opacity,
    settings.markerStyle,
    settings.markerLength,
    settings.markerThickness,
  ]);

  return (
    <canvas
      data-toolcraft-flow-canvas=""
      ref={canvasRef}
      style={{ display: "block", height: "100%", width: "100%" }}
    />
  );
}
