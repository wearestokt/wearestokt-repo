"use client";

import * as React from "react";

import { shouldIncludeToolcraftPreviewBackground } from "@/toolcraft/runtime";
import type { ToolcraftState } from "@/toolcraft/runtime";
import { useToolcraft } from "@/toolcraft/runtime/react";
import {
  getFontPickerFontById,
  type FontPickerValue,
} from "@/toolcraft/ui/components/controls/font-picker";
import { ensureFontPickerPreviewLoaded } from "@/toolcraft/ui/components/controls/font-picker/font-preview-loader";

import { createVectorField, type FlowFieldPattern } from "./flow-vector-field";
import type { FlowPath } from "./flow-path-math";
import {
  buildCanvasFont,
  ensureBrandFontsLoaded,
  resolveTypography,
  type ResolvedTypography,
} from "./word-font";
import { layoutWordFlow, type WordFlowSettings } from "./word-flow-layout";
import { layoutWordGrid, type WordGridSettings } from "./word-grid-layout";
import type { MeasureWord, PlacedWord } from "./word-layout-types";
import { buildShapeMask, type ShapeMask } from "./word-mask";
import {
  buildSourceImageCacheKey,
  getSourceImageAsset,
  prepareSourceImageFromAsset,
} from "./word-source-raster";
import type { PreparedSourceImage } from "./word-source-sample";

const defaultBackgroundHex = "#F5F2EC";
const defaultHighlightHex = "#FFE14D";

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asString<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function asText(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
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

const defaultFontValue: FontPickerValue = {
  color: "#16324F",
  fontId: "ibm-plex-mono",
  fontSize: 18,
  fontWeight: "500",
  letterSpacing: "normal",
  lineHeight: "normal",
  opacity: 100,
  textCase: "uppercase",
};

export function readFontValue(state: ToolcraftState): FontPickerValue {
  const raw = state.values["type.font"];
  if (!raw || typeof raw !== "object") {
    return defaultFontValue;
  }
  const value = raw as Partial<FontPickerValue>;
  return {
    color: typeof value.color === "string" ? value.color : defaultFontValue.color,
    fontId: typeof value.fontId === "string" ? value.fontId : defaultFontValue.fontId,
    fontSize: asNumber(value.fontSize, defaultFontValue.fontSize),
    fontWeight:
      typeof value.fontWeight === "string" ? value.fontWeight : defaultFontValue.fontWeight,
    letterSpacing: (value.letterSpacing ?? defaultFontValue.letterSpacing) as FontPickerValue["letterSpacing"],
    lineHeight: (value.lineHeight ?? defaultFontValue.lineHeight) as FontPickerValue["lineHeight"],
    opacity: asNumber(value.opacity, defaultFontValue.opacity),
    textCase: (value.textCase ?? defaultFontValue.textCase) as FontPickerValue["textCase"],
  };
}

function readPaths(state: ToolcraftState): FlowPath[] {
  const raw = state.values["paths.data"];
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { paths?: unknown }).paths)) {
    return [];
  }
  return (raw as { paths: FlowPath[] }).paths;
}

export type WordTideSettings = {
  fieldDirection: number;
  fieldFrequency: number;
  fieldPattern: FlowFieldPattern;
  fieldSwirl: number;
  fieldTurbulence: number;
  flowDensity: number;
  flowWordGap: number;
  gridGap: number;
  gridJitter: number;
  highlightColor: string;
  highlightCoverage: number;
  highlightWords: string;
  inkContrast: number;
  inkFade: boolean;
  inkInvert: boolean;
  inkSparsity: number;
  inkWeightRange: number;
  maskFeather: number;
  maskInvert: boolean;
  mode: "dither" | "flow";
  order: "random" | "sequential";
  paths: FlowPath[];
  pathsReach: number;
  pathsStrength: number;
  seed: number;
  words: string;
  zonesDark: string;
  zonesEnabled: boolean;
  zonesLight: string;
  zonesMid: string;
  zonesSplit: [number, number];
};

export function readWordTideSettings(state: ToolcraftState): WordTideSettings {
  const values = state.values;
  const splitRaw = values["zones.split"];
  const split: [number, number] =
    Array.isArray(splitRaw) && splitRaw.length === 2
      ? [asNumber(splitRaw[0], 35), asNumber(splitRaw[1], 65)]
      : [35, 65];

  return {
    fieldDirection: asNumber(values["flow.direction"], 200),
    fieldFrequency: asNumber(values["flow.frequency"], 14),
    fieldPattern: asString(
      values["flow.pattern"],
      ["currents", "vortex", "waves", "turbulent", "radial"] as const,
      "currents",
    ),
    fieldSwirl: asNumber(values["flow.swirl"], 8),
    fieldTurbulence: asNumber(values["flow.turbulence"], 10),
    flowDensity: asNumber(values["streams.density"], 55),
    flowWordGap: asNumber(values["streams.wordGap"], 6),
    gridGap: asNumber(values["grid.gap"], 6),
    gridJitter: asNumber(values["grid.jitter"], 0),
    highlightColor: asHex(values["highlight.color"], defaultHighlightHex),
    highlightCoverage: asNumber(values["highlight.coverage"], 0),
    highlightWords: asText(values["highlight.words"], ""),
    inkContrast: asNumber(values["source.contrast"], 0),
    inkFade: asBoolean(values["ink.fade"], true),
    inkInvert: asBoolean(values["source.invert"], false),
    inkSparsity: asNumber(values["ink.sparsity"], 0),
    inkWeightRange: asNumber(values["ink.weightRange"], 60),
    maskFeather: asNumber(values["mask.feather"], 0),
    maskInvert: asBoolean(values["mask.invert"], false),
    mode: asString(values["mode.render"], ["dither", "flow"] as const, "flow"),
    order: asString(values["words.order"], ["sequential", "random"] as const, "sequential"),
    paths: readPaths(state),
    pathsReach: asNumber(values["paths.reach"], 45),
    pathsStrength: asNumber(values["paths.strength"], 55),
    seed: asNumber(values["tide.seed"], 21),
    words: asText(
      values["words.list"],
      "OCEAN TIDE CURRENT HARBOR DOCK CARGO SWELL DRIFT NORTH ANCHOR VESSEL PORT",
    ),
    zonesDark: asText(values["zones.dark"], ""),
    zonesEnabled: asBoolean(values["zones.enabled"], false),
    zonesLight: asText(values["zones.light"], ""),
    zonesMid: asText(values["zones.mid"], ""),
    zonesSplit: split,
  };
}

export function readTideBackgroundHex(state: ToolcraftState): string {
  return asHex(state.values["appearance.background"], defaultBackgroundHex);
}

/** Word width measurer backed by an offscreen Canvas 2D context. */
export function createWordMeasurer(typography: ResolvedTypography): MeasureWord {
  const cache = new Map<string, number>();
  let context: CanvasRenderingContext2D | null = null;

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    context = canvas.getContext("2d");
    if (context && "letterSpacing" in context) {
      (context as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        `${typography.letterSpacingEm * typography.fontSize}px`;
    }
  }

  return (text, weight) => {
    const key = `${weight}:${text}`;
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    let width: number;
    if (context) {
      context.font = buildCanvasFont(typography, weight);
      width = context.measureText(text).width;
    } else {
      // Headless fallback: monospace estimate.
      width = text.length * typography.fontSize * 0.6;
    }
    cache.set(key, width);
    return width;
  };
}

export type WordTideLayout = {
  canvasHeight: number;
  canvasWidth: number;
  typography: ResolvedTypography;
  words: PlacedWord[];
};

const layoutCache = new Map<string, WordTideLayout>();

export function buildWordTideLayout(
  canvasWidth: number,
  canvasHeight: number,
  settings: WordTideSettings,
  font: FontPickerValue,
  image: PreparedSourceImage | null,
  imageKey: string,
  mask: ShapeMask | null,
  maskKey: string,
  fontsVersion: number,
): WordTideLayout {
  const cacheKey = JSON.stringify({
    canvasHeight,
    canvasWidth,
    font,
    fontsVersion,
    imageKey,
    maskKey,
    settings,
  });
  const cached = layoutCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const typography = resolveTypography(font);
  const measure = createWordMeasurer(typography);
  const ink = {
    contrast: settings.inkContrast,
    fade: settings.inkFade,
    invert: settings.inkInvert,
    sparsity: settings.inkSparsity,
    weightRange: settings.inkWeightRange,
  };
  const highlight = {
    coverage: settings.highlightCoverage,
    words: settings.highlightWords,
  };

  let words: PlacedWord[];

  if (settings.mode === "dither") {
    const gridSettings: WordGridSettings = {
      gap: settings.gridGap,
      highlight,
      ink,
      jitter: settings.gridJitter,
      order: settings.order,
      seed: settings.seed,
      words: settings.words,
      zones: {
        darkWords: settings.zonesDark,
        enabled: settings.zonesEnabled,
        lightWords: settings.zonesLight,
        midWords: settings.zonesMid,
        split: settings.zonesSplit,
      },
    };
    words = layoutWordGrid(canvasWidth, canvasHeight, typography, gridSettings, image, mask, measure);
  } else {
    const field = createVectorField(
      canvasWidth,
      canvasHeight,
      {
        direction: settings.fieldDirection,
        frequency: settings.fieldFrequency,
        pattern: settings.fieldPattern,
        seed: settings.seed,
        snapAngles: "off",
        swirl: settings.fieldSwirl,
        turbulence: settings.fieldTurbulence,
      },
      {
        paths: settings.paths,
        reach: settings.pathsReach,
        smoothness: 72,
        strength: settings.pathsStrength,
      },
    );
    const flowSettings: WordFlowSettings = {
      density: settings.flowDensity,
      highlight,
      ink,
      order: settings.order,
      seed: settings.seed,
      wordGap: settings.flowWordGap,
      words: settings.words,
    };
    words = layoutWordFlow(canvasWidth, canvasHeight, typography, flowSettings, field, image, mask, measure);
  }

  const layout: WordTideLayout = { canvasHeight, canvasWidth, typography, words };
  layoutCache.set(cacheKey, layout);
  if (layoutCache.size > 8) {
    const first = layoutCache.keys().next().value;
    if (first) {
      layoutCache.delete(first);
    }
  }
  return layout;
}

export type DrawWordTideOptions = {
  highlightColor: string;
  layout: WordTideLayout;
};

export function drawWordTide(
  context: CanvasRenderingContext2D,
  { highlightColor, layout }: DrawWordTideOptions,
): void {
  const { typography, words } = layout;
  const fontSize = typography.fontSize;
  const highlightPadX = fontSize * 0.18;
  const highlightAscent = fontSize * 0.82;
  const highlightDescent = fontSize * 0.24;

  context.save();
  if ("letterSpacing" in context) {
    (context as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${typography.letterSpacingEm * fontSize}px`;
  }

  context.fillStyle = highlightColor;
  for (const word of words) {
    if (!word.highlighted) {
      continue;
    }
    context.globalAlpha = Math.min(1, word.opacity + 0.15);
    context.save();
    context.translate(word.x, word.y);
    if (word.angle !== 0) {
      context.rotate(word.angle);
    }
    context.fillRect(
      -highlightPadX,
      -highlightAscent,
      word.width + highlightPadX * 2,
      highlightAscent + highlightDescent,
    );
    context.restore();
  }

  const byWeight = new Map<number, PlacedWord[]>();
  for (const word of words) {
    const bucket = byWeight.get(word.fontWeight);
    if (bucket) {
      bucket.push(word);
    } else {
      byWeight.set(word.fontWeight, [word]);
    }
  }

  context.fillStyle = typography.color;
  context.textBaseline = "alphabetic";
  for (const [weight, bucket] of byWeight) {
    context.font = buildCanvasFont(typography, weight);
    for (const word of bucket) {
      context.globalAlpha = word.opacity;
      if (word.angle === 0) {
        context.fillText(word.text, word.x, word.y);
      } else {
        context.save();
        context.translate(word.x, word.y);
        context.rotate(word.angle);
        context.fillText(word.text, 0, 0);
        context.restore();
      }
    }
  }

  context.restore();
}

const imageCache = new Map<string, PreparedSourceImage>();

function usePreparedAsset(
  state: ToolcraftState,
  sourceTarget: string,
): { image: PreparedSourceImage | null; key: string } {
  const asset = getSourceImageAsset(state.mediaAssets, sourceTarget);
  const { height, width } = state.canvas.size;
  const key = asset ? buildSourceImageCacheKey(asset, width, height) : "";
  const [, forceRender] = React.useReducer((tick: number) => tick + 1, 0);

  React.useEffect(() => {
    if (!asset || imageCache.has(key)) {
      return;
    }
    let cancelled = false;
    void prepareSourceImageFromAsset(asset, width, height).then((prepared) => {
      if (cancelled) {
        return;
      }
      imageCache.set(key, prepared);
      if (imageCache.size > 6) {
        const first = imageCache.keys().next().value;
        if (first) {
          imageCache.delete(first);
        }
      }
      forceRender();
    });
    return () => {
      cancelled = true;
    };
  }, [asset, height, key, width]);

  return { image: asset ? (imageCache.get(key) ?? null) : null, key };
}

const maskCache = new Map<string, ShapeMask>();

function useShapeMask(
  state: ToolcraftState,
  invert: boolean,
  featherPx: number,
): { key: string; mask: ShapeMask | null } {
  const { image, key: rasterKey } = usePreparedAsset(state, "media.maskImage");
  const key = rasterKey ? `${rasterKey}:${invert ? 1 : 0}:${Math.round(featherPx)}` : "";

  if (!image || !key) {
    return { key: "", mask: null };
  }

  let mask = maskCache.get(key);
  if (!mask) {
    mask = buildShapeMask(image, invert, featherPx);
    maskCache.set(key, mask);
    if (maskCache.size > 6) {
      const first = maskCache.keys().next().value;
      if (first) {
        maskCache.delete(first);
      }
    }
  }

  return { key, mask };
}

/** Loads brand + catalog fonts, bumping a version once glyphs are usable. */
function useFontsReady(font: FontPickerValue): number {
  const [version, setVersion] = React.useState(0);
  const entry = getFontPickerFontById(font.fontId);
  const entryId = entry?.id ?? "";

  React.useEffect(() => {
    let cancelled = false;
    const tasks: Promise<unknown>[] = [ensureBrandFontsLoaded()];
    if (entry) {
      tasks.push(ensureFontPickerPreviewLoaded(entry));
    }
    void Promise.all(tasks).then(() => {
      if (!cancelled) {
        setVersion((current) => current + 1);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId]);

  return version;
}

export function buildWordTideLayoutForState(
  state: ToolcraftState,
  image: PreparedSourceImage | null,
  imageKey: string,
  mask: ShapeMask | null,
  maskKey: string,
  fontsVersion = 0,
): WordTideLayout {
  const settings = readWordTideSettings(state);
  const font = readFontValue(state);
  return buildWordTideLayout(
    state.canvas.size.width,
    state.canvas.size.height,
    settings,
    font,
    image,
    imageKey,
    mask,
    maskKey,
    fontsVersion,
  );
}

export function getPreparedSourceImageForState(state: ToolcraftState): {
  image: PreparedSourceImage | null;
  key: string;
} {
  const asset = getSourceImageAsset(state.mediaAssets, "media.sourceImage");
  const { height, width } = state.canvas.size;
  const key = asset ? buildSourceImageCacheKey(asset, width, height) : "";
  return { image: key ? (imageCache.get(key) ?? null) : null, key };
}

export function getShapeMaskForState(state: ToolcraftState): {
  key: string;
  mask: ShapeMask | null;
} {
  const settings = readWordTideSettings(state);
  const asset = getSourceImageAsset(state.mediaAssets, "media.maskImage");
  const { height, width } = state.canvas.size;
  const rasterKey = asset ? buildSourceImageCacheKey(asset, width, height) : "";
  const key = rasterKey
    ? `${rasterKey}:${settings.maskInvert ? 1 : 0}:${Math.round(settings.maskFeather)}`
    : "";
  return { key, mask: key ? (maskCache.get(key) ?? null) : null };
}

export function WordTideCanvas(): React.JSX.Element {
  const { state } = useToolcraft();
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const deferredState = React.useDeferredValue(state);

  const size = deferredState.canvas.size;
  const settings = readWordTideSettings(deferredState);
  const font = readFontValue(deferredState);
  const backgroundHex = readTideBackgroundHex(deferredState);
  const includeBackground = shouldIncludeToolcraftPreviewBackground({ state: deferredState });
  const renderScale = asNumber(deferredState.values["canvas.renderScale"], 1);
  const fontsVersion = useFontsReady(font);

  const { image, key: imageKey } = usePreparedAsset(deferredState, "media.sourceImage");
  const { key: maskKey, mask } = useShapeMask(
    deferredState,
    settings.maskInvert,
    settings.maskFeather,
  );

  const layout = React.useMemo(
    () =>
      buildWordTideLayout(
        size.width,
        size.height,
        settings,
        font,
        image,
        imageKey,
        mask,
        maskKey,
        fontsVersion,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      size.width,
      size.height,
      JSON.stringify(settings),
      JSON.stringify(font),
      image,
      imageKey,
      mask,
      maskKey,
      fontsVersion,
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
    drawWordTide(context, {
      highlightColor: settings.highlightColor,
      layout,
    });
  }, [
    layout,
    size.width,
    size.height,
    renderScale,
    includeBackground,
    backgroundHex,
    settings.highlightColor,
  ]);

  return (
    <canvas
      data-toolcraft-word-tide-canvas=""
      ref={canvasRef}
      style={{ display: "block", height: "100%", width: "100%" }}
    />
  );
}
