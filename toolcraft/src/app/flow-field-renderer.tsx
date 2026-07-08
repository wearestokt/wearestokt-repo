"use client";

import * as React from "react";

import { shouldIncludeToolcraftPreviewBackground } from "@/toolcraft/runtime";
import type { ToolcraftState } from "@/toolcraft/runtime";
import { useToolcraft } from "@/toolcraft/runtime/react";

import {
  colorForStroke,
  colorForStrokePoint,
  type FlowColorSettings,
} from "./flow-color-ramp";
import {
  CUSTOM_SLOT_COUNT,
  defaultFlowPaletteSettings,
  type FlowPaletteSettings,
  type PalettePresetId,
} from "./flow-palette";
import type { FlowFieldPattern, SnapAngles } from "./flow-vector-field";
import {
  defaultFlowPathSettings,
  scalePathSettings,
  type FlowPath,
  type FlowPathSettings,
} from "./flow-path-math";
import {
  buildStrokeRibbon,
  drawArrowHead,
  drawHatchFill,
  drawRectangleStroke,
  drawRibbonOnCanvas,
  drawStrokeCenterline,
  splitStrokeIntoDashes,
  type StrokeStyleOptions,
} from "./flow-stroke-geometry";
import {
  buildFlowOutput,
  type FlowMarkerStyle,
  type FlowOutput,
  type FlowStroke,
  type FlowTaper,
  type SpacingMode,
  type StreamSettings,
} from "./flow-streamline-math";

export type FlowMarkerColor = {
  hex: string;
  opacity: number;
};

export type StrokeSettings = {
  headSize: number;
  sizeVariety: number;
  style: FlowMarkerStyle;
  taper: FlowTaper;
  width: number;
  widthBySpeed: number;
};

const defaultField = {
  direction: 200,
  frequency: 14,
  pattern: "currents" as FlowFieldPattern,
  seed: 21,
  snapAngles: "off" as SnapAngles,
  swirl: 8,
  turbulence: 10,
};

const defaultStreams: StreamSettings = {
  density: 16,
  gap: 4,
  lengthContrast: 75,
  lengthMax: 220,
  lengthMin: 10,
  margin: 24,
  smoothness: 72,
  spacingMode: "even",
};

const defaultStroke: StrokeSettings = {
  headSize: 1,
  sizeVariety: 15,
  style: "line",
  taper: "tail",
  width: 2,
  widthBySpeed: 35,
};

const defaultBackgroundHex = "#0A1E3D";

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

function readPaths(state: ToolcraftState): FlowPath[] {
  const raw = state.values["paths.data"];
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { paths?: unknown }).paths)) {
    return [];
  }
  return (raw as { paths: FlowPath[] }).paths;
}

export function readFlowFieldSettings(state: ToolcraftState) {
  const values = state.values;
  return {
    direction: asNumber(values["flow.direction"], defaultField.direction),
    frequency: asNumber(values["flow.frequency"], defaultField.frequency),
    pattern: asString(
      values["flow.pattern"],
      ["currents", "vortex", "waves", "turbulent", "radial"] as const,
      defaultField.pattern,
    ),
    seed: asNumber(values["flow.seed"], defaultField.seed),
    snapAngles: asString(
      values["flow.snapAngles"],
      ["off", "45", "60", "90"] as const,
      defaultField.snapAngles,
    ),
    swirl: asNumber(values["flow.swirl"], defaultField.swirl),
    turbulence: asNumber(values["flow.turbulence"], defaultField.turbulence),
  };
}

export function readStreamSettings(state: ToolcraftState): StreamSettings {
  const values = state.values;
  return {
    density: asNumber(values["streams.density"], defaultStreams.density),
    gap: asNumber(values["streams.gap"], defaultStreams.gap),
    lengthContrast: asNumber(values["streams.lengthContrast"], defaultStreams.lengthContrast),
    lengthMax: asNumber(values["streams.lengthMax"], defaultStreams.lengthMax),
    lengthMin: asNumber(values["streams.lengthMin"], defaultStreams.lengthMin),
    margin: asNumber(values["streams.margin"], defaultStreams.margin),
    smoothness: asNumber(values["streams.smoothness"], defaultStreams.smoothness),
    spacingMode: asString(
      values["streams.spacingMode"],
      ["even", "packed", "loose"] as const,
      defaultStreams.spacingMode,
    ),
  };
}

export function readStrokeSettings(state: ToolcraftState): StrokeSettings {
  const values = state.values;
  return {
    headSize: asNumber(values["stroke.headSize"], defaultStroke.headSize),
    sizeVariety: asNumber(values["stroke.sizeVariety"], defaultStroke.sizeVariety),
    style: asString(
      values["stroke.style"],
      ["arrow", "dash", "hatch", "line", "rectangle"] as const,
      defaultStroke.style,
    ),
    taper: asString(values["stroke.taper"], ["both", "head", "none", "tail"] as const, defaultStroke.taper),
    width: asNumber(values["stroke.width"], defaultStroke.width),
    widthBySpeed: asNumber(values["stroke.widthBySpeed"], defaultStroke.widthBySpeed),
  };
}

export function readFlowPaletteSettings(state: ToolcraftState): FlowPaletteSettings {
  const values = state.values;
  const presetId = asString(
    values["color.palette"],
    [
      "ocean",
      "ember",
      "newsprint",
      "golden-hour",
      "neon",
      "monochrome",
      "ink",
      "pastel",
      "twilight",
      "custom",
    ] as const,
    defaultFlowPaletteSettings.presetId,
  );

  const customSlots = Array.from({ length: CUSTOM_SLOT_COUNT }, (_, index) => {
    const slotKey = `color.custom${index + 1}` as const;
    const defaultSlot = defaultFlowPaletteSettings.customSlots[index];
    const slot = values[slotKey];
    return {
      hex: asHex(slot, defaultSlot?.hex ?? "#FFFFFF"),
      weight: defaultSlot?.weight ?? 20,
    };
  });

  return {
    assignmentMode: asString(
      values["color.assignmentMode"],
      ["weighted", "inheritance", "speed", "vertical"] as const,
      defaultFlowPaletteSettings.assignmentMode,
    ),
    customSlots,
    opacity: asNumber(values["color.opacity"], defaultFlowPaletteSettings.opacity),
    presetId: presetId as PalettePresetId,
  };
}

/** @deprecated Use readFlowPaletteSettings */
export const readFlowColorSettings = readFlowPaletteSettings;

export function readFlowPathSettings(state: ToolcraftState): FlowPathSettings {
  return {
    lengthContrast: asNumber(
      state.values["streams.lengthContrast"],
      defaultFlowPathSettings.lengthContrast,
    ),
    paths: readPaths(state),
    reach: asNumber(state.values["paths.reach"], defaultFlowPathSettings.reach),
    smoothness: asNumber(state.values["streams.smoothness"], defaultFlowPathSettings.smoothness),
    strength: asNumber(state.values["paths.strength"], defaultFlowPathSettings.strength),
    thickness: asNumber(state.values["stroke.width"], defaultFlowPathSettings.thickness),
  };
}

export function readFlowBackgroundHex(state: ToolcraftState): string {
  return asHex(state.values["appearance.background"], defaultBackgroundHex);
}

export function readFlowMarkerColor(state: ToolcraftState): FlowMarkerColor {
  const palette = readFlowPaletteSettings(state);
  const hex = palette.customSlots[0]?.hex ?? "#E8F4FF";
  return { hex, opacity: palette.opacity };
}

type TraceCacheKey = string;
const traceCache = new Map<TraceCacheKey, FlowOutput>();

function buildTraceCacheKey(
  width: number,
  height: number,
  fieldSettings: ReturnType<typeof readFlowFieldSettings>,
  pathSettings: FlowPathSettings,
  streamSettings: StreamSettings,
  paletteSettings: FlowPaletteSettings,
  strokeStyle: FlowMarkerStyle,
  strokeWidth: number,
  sizeVariety: number,
): string {
  return JSON.stringify({
    fieldSettings,
    height,
    paletteSettings,
    pathSettings,
    sizeVariety,
    streamSettings,
    strokeStyle,
    strokeWidth,
    width,
  });
}

export function buildFlowOutputForState(
  width: number,
  height: number,
  state: ToolcraftState,
): FlowOutput {
  const canvasWidth = state.canvas.size.width;
  const canvasHeight = state.canvas.size.height;
  const pathSettings = scalePathSettings(
    readFlowPathSettings(state),
    canvasWidth,
    canvasHeight,
    width,
    height,
  );
  const fieldSettings = readFlowFieldSettings(state);
  const streamSettings = readStreamSettings(state);
  const strokeSettings = readStrokeSettings(state);
  const paletteSettings = readFlowPaletteSettings(state);
  const cacheKey = buildTraceCacheKey(
    width,
    height,
    fieldSettings,
    pathSettings,
    streamSettings,
    paletteSettings,
    strokeSettings.style,
    strokeSettings.width,
    strokeSettings.sizeVariety,
  );
  const cached = traceCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const output = buildFlowOutput(
    width,
    height,
    fieldSettings,
    pathSettings,
    streamSettings,
    strokeSettings.style,
    strokeSettings.width,
    paletteSettings,
    strokeSettings.sizeVariety,
  );
  traceCache.set(cacheKey, output);
  if (traceCache.size > 12) {
    const first = traceCache.keys().next().value;
    if (first) {
      traceCache.delete(first);
    }
  }
  return output;
}

function drawStyledStroke(
  context: CanvasRenderingContext2D,
  stroke: FlowStroke,
  paletteSettings: FlowPaletteSettings,
  strokeOptions: StrokeStyleOptions,
  canvasHeight: number,
  globalStyle: FlowMarkerStyle,
): void {
  const style = globalStyle;
  const fill = colorForStroke(stroke, paletteSettings);
  const useRibbon =
    style !== "rectangle" &&
    (strokeOptions.taper !== "none" || (strokeOptions.widthBySpeed ?? 0) > 0);
  const segments =
    style === "dash"
      ? splitStrokeIntoDashes(stroke).map((segment) => ({ ...stroke, points: segment.points }))
      : [stroke];

  for (const segment of segments) {
    const segmentFill =
      paletteSettings.assignmentMode === "speed" || paletteSettings.assignmentMode === "vertical"
        ? colorForStrokePoint(
            paletteSettings,
            segment,
            Math.floor(segment.points.length / 2),
            canvasHeight,
          )
        : fill;

    context.save();
    context.fillStyle = segmentFill;
    context.strokeStyle = segmentFill;
    context.lineCap = style === "rectangle" ? "butt" : "round";
    context.lineJoin = style === "rectangle" ? "miter" : "round";

    if (style === "rectangle") {
      drawRectangleStroke(context, segment, segment.thickness);
    } else if (style === "hatch") {
      const ribbon = buildStrokeRibbon(segment, { ...strokeOptions, taper: "none" });
      drawRibbonOnCanvas(context, ribbon);
      context.strokeStyle = segmentFill;
      drawHatchFill(context, ribbon, segment.sizeClass === "xl" ? 8 : 5);
    } else if (useRibbon) {
      const ribbon = buildStrokeRibbon(segment, strokeOptions);
      drawRibbonOnCanvas(context, ribbon);
    } else {
      context.lineWidth = segment.thickness;
      drawStrokeCenterline(context, segment.points);
    }

    if (style === "arrow" && segment.points.length >= 2) {
      const tip = segment.points[segment.points.length - 1]!;
      const from = segment.points[segment.points.length - 2]!;
      drawArrowHead(context, tip, from, segment.thickness, strokeOptions.headSize ?? 1);
    }
    context.restore();
  }
}

export type DrawFlowFieldOptions = {
  colorSettings: FlowColorSettings;
  height: number;
  output: FlowOutput;
  strokeSettings: StrokeSettings;
  width: number;
};

export function drawFlowField(
  context: CanvasRenderingContext2D,
  { colorSettings, height, output, strokeSettings, width }: DrawFlowFieldOptions,
): void {
  const strokeOptions: StrokeStyleOptions = {
    headSize: strokeSettings.headSize,
    taper: strokeSettings.taper,
    widthBySpeed: strokeSettings.widthBySpeed,
  };

  context.save();
  for (const stroke of output.strokes) {
    drawStyledStroke(
      context,
      stroke,
      colorSettings,
      strokeOptions,
      height,
      strokeSettings.style,
    );
  }
  context.restore();
  void width;
}

export function FlowFieldCanvas(): React.JSX.Element {
  const { state } = useToolcraft();
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const deferredState = React.useDeferredValue(state);

  const size = deferredState.canvas.size;
  const colorSettings = readFlowPaletteSettings(deferredState);
  const strokeSettings = readStrokeSettings(deferredState);
  const backgroundHex = readFlowBackgroundHex(deferredState);
  const includeBackground = shouldIncludeToolcraftPreviewBackground({ state: deferredState });
  const renderScale = asNumber(deferredState.values["canvas.renderScale"], 1);

  const output = React.useMemo(
    () => buildFlowOutputForState(size.width, size.height, deferredState),
    [deferredState, size.height, size.width],
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
    drawFlowField(context, {
      colorSettings,
      height: size.height,
      output,
      strokeSettings,
      width: size.width,
    });
  }, [
    output,
    size.width,
    size.height,
    renderScale,
    includeBackground,
    backgroundHex,
    colorSettings,
    strokeSettings,
  ]);

  return (
    <canvas
      data-toolcraft-flow-canvas=""
      ref={canvasRef}
      style={{ display: "block", height: "100%", width: "100%" }}
    />
  );
}

export const buildFlowGlyphsForState = buildFlowOutputForState;
