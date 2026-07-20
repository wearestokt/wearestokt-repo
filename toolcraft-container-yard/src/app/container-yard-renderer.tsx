"use client";

import * as React from "react";

import { shouldIncludeToolcraftPreviewBackground } from "@/toolcraft/runtime";
import type { ToolcraftState } from "@/toolcraft/runtime";
import { useToolcraft } from "@/toolcraft/runtime/react";

import {
  buildContainerYard,
  DEFAULT_CONTAINER_COLORS,
  drawContainerYard,
  isContainerYardDitherActive,
  type ContainerColorMode,
  type ContainerLayout,
  type ContainerLayoutType,
  type ContainerMatteStyle,
  type ContainerOrientation,
  type ContainerRadialAlign,
  type ContainerStripeOrientation,
  type ContainerWaveAxis,
  type ContainerZoneAxis,
  type ContainerYardOutput,
  type ContainerYardSettings,
} from "./container-yard-math";
import { normalizeDitherAlgorithm } from "./container-yard-dither";
import type { PreparedSourceImage } from "./container-yard-image-sample";
import {
  buildSourceImageCacheKey,
  getSourceImageAsset,
  prepareSourceImageFromAsset,
} from "./container-yard-image-raster";
import { normalizeMatteStyle } from "./container-yard-source-matte";
import { AsciiGridDefaultsSync } from "./container-yard-ascii-grid";

const defaultBackgroundHex = "#0A0A0A";
const sourceImageCache = new Map<string, PreparedSourceImage>();

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

function readColorAt(state: ToolcraftState, index: number): string {
  const target = `yard.color${index + 1}`;
  return asHex(state.values[target], DEFAULT_CONTAINER_COLORS[index] ?? DEFAULT_CONTAINER_COLORS[0]!);
}

function readSpatialOffsetPx(
  offsetRaw: unknown,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  let normalizedX = 0;
  let normalizedY = 0;

  if (offsetRaw && typeof offsetRaw === "object") {
    const raw = offsetRaw as { x?: unknown; y?: unknown };
    normalizedX =
      typeof raw.x === "number"
        ? raw.x
        : Number.parseFloat(typeof raw.x === "string" ? raw.x : "0");
    normalizedY =
      typeof raw.y === "number"
        ? raw.y
        : Number.parseFloat(typeof raw.y === "string" ? raw.y : "0");
  }

  const clamp = (value: number) =>
    Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;

  return {
    x: clamp(normalizedX) * (canvasWidth / 2),
    y: clamp(normalizedY) * (canvasHeight / 2),
  };
}

function asPaletteSlot(value: unknown, fallback: number): number {
  const slot = Math.round(asNumber(value, fallback));
  return Math.min(8, Math.max(1, slot));
}

export function readContainerYardSettings(state: ToolcraftState): ContainerYardSettings {
  const values = state.values;
  const canvasWidth = state.canvas.size.width;
  const canvasHeight = state.canvas.size.height;
  const offset = readSpatialOffsetPx(values["yard.offset"], canvasWidth, canvasHeight);

  const colorCount = Math.min(
    8,
    Math.max(1, Math.round(asNumber(values["yard.colorCount"], 4))),
  );

  return {
    colorCount,
    colorMode: asString<ContainerColorMode>(
      values["yard.colorMode"],
      [
        "random",
        "wave",
        "zones",
        "stripes",
        "checker",
        "quadrants",
        "rings",
        "clusters",
        "chevron",
      ],
      "random",
    ),
    colors: Array.from({ length: 8 }, (_, index) => readColorAt(state, index)),
    columnGap: asNumber(values["yard.columnGap"], 3),
    containInCanvas: values["yard.containInCanvas"] === true,
    containerWidth: asNumber(values["yard.containerWidth"], 28),
    ditherAlgorithm: normalizeDitherAlgorithm(values["yard.ditherAlgorithm"]),
    ditherBias: asNumber(values["yard.ditherBias"], 0),
    ditherContrast: asNumber(values["yard.ditherContrast"], 0),
    ditherEnabled: values["yard.layoutType"] === "dither",
    ditherInvert: values["yard.ditherInvert"] === true,
    ditherStrength: asNumber(values["yard.ditherStrength"], 0),
    globalScale: asNumber(values["yard.globalScale"], 100),
    layout: asString<ContainerLayout>(values["yard.layout"], ["rows", "columns"], "rows"),
    layoutType: asString<ContainerLayoutType>(
      values["yard.layoutType"],
      ["rectangular", "radial", "dither"],
      "rectangular",
    ),
    lengthLong: asNumber(values["yard.lengthLong"], 140),
    lengthMix: asNumber(values["yard.lengthMix"], 0),
    lengthShort: asNumber(values["yard.lengthShort"], 72),
    matteMinCoverage: asNumber(values["yard.matteMinCoverage"], 15),
    matteStyle: asString<ContainerMatteStyle>(
      normalizeMatteStyle(values["yard.matteStyle"]),
      ["off", "alpha", "auto", "both"],
      "both",
    ),
    offsetX: offset.x,
    offsetY: offset.y,
    orientation: asString<ContainerOrientation>(
      values["yard.orientation"],
      ["vertical", "horizontal"],
      "vertical",
    ),
    colorPatternStep: asNumber(values["yard.colorPatternStep"], 4),
    radialAlign: asString<ContainerRadialAlign>(
      values["yard.radialAlign"],
      ["tangent", "radial"],
      "tangent",
    ),
    randomGaps: asNumber(values["yard.randomGaps"], 8),
    rotation: asNumber(values["yard.rotation"], 0),
    rowGap: asNumber(values["yard.rowGap"], 3),
    seed: Math.round(asNumber(values["yard.seed"], 42)),
    shadowEnabled: values["yard.shadowEnabled"] === true,
    shadowOffsetX: asNumber(values["yard.shadowOffsetX"], 6),
    shadowOffsetY: asNumber(values["yard.shadowOffsetY"], 6),
    shadowOpacity: asNumber(values["yard.shadowOpacity"], 35),
    stagger: asNumber(values["yard.stagger"], 0),
    stripeColorSlot: asPaletteSlot(values["yard.stripeColorSlot"], 1),
    stripeOrientation: asString<ContainerStripeOrientation>(
      values["yard.stripeOrientation"],
      ["horizontal", "vertical", "diagonal"],
      "diagonal",
    ),
    stripeRepeat: asNumber(values["yard.stripeRepeat"], 6),
    stripeWidth: asNumber(values["yard.stripeWidth"], 40),
    waveAxis: asString<ContainerWaveAxis>(
      values["yard.waveAxis"],
      ["row", "column", "radial"],
      "column",
    ),
    waveCycles: asNumber(values["yard.waveCycles"], 3),
    zone1Slot: asPaletteSlot(values["yard.zone1Slot"], 1),
    zone2Slot: asPaletteSlot(values["yard.zone2Slot"], 2),
    zone3Slot: asPaletteSlot(values["yard.zone3Slot"], 3),
    zone4Slot: asPaletteSlot(values["yard.zone4Slot"], 4),
    zoneAxis: asString<ContainerZoneAxis>(
      values["yard.zoneAxis"],
      ["horizontal", "vertical"],
      "horizontal",
    ),
    zoneCount: Math.min(
      4,
      Math.max(2, Math.round(asNumber(values["yard.zoneCount"], 2))),
    ),
  };
}

export function readContainerYardBackgroundHex(state: ToolcraftState): string {
  return asHex(state.values["appearance.background"], defaultBackgroundHex);
}

export function getCachedSourceImageData(state: ToolcraftState): PreparedSourceImage | null {
  const asset = getSourceImageAsset(state.mediaAssets);
  if (!asset) {
    return null;
  }

  const { height, width } = state.canvas.size;
  return sourceImageCache.get(buildSourceImageCacheKey(asset, width, height)) ?? null;
}

export async function resolveSourceImageData(
  state: ToolcraftState,
): Promise<PreparedSourceImage | null> {
  const cached = getCachedSourceImageData(state);
  if (cached) {
    return cached;
  }

  const asset = getSourceImageAsset(state.mediaAssets);
  if (!asset) {
    return null;
  }

  const { height, width } = state.canvas.size;
  const prepared = await prepareSourceImageFromAsset(asset, width, height);
  sourceImageCache.set(buildSourceImageCacheKey(asset, width, height), prepared);
  return prepared;
}

export function buildContainerYardOutputForState(
  width: number,
  height: number,
  state: ToolcraftState,
  imageData?: PreparedSourceImage | null,
): ContainerYardOutput {
  const canvasWidth = state.canvas.size.width;
  const canvasHeight = state.canvas.size.height;
  const scaleX = width / canvasWidth;
  const scaleY = height / canvasHeight;
  const settings = readContainerYardSettings(state);

  const build = (targetSettings: ContainerYardSettings) =>
    buildContainerYard(width, height, targetSettings, {
      imageData: isContainerYardDitherActive(targetSettings) ? imageData ?? null : null,
    });

  if (scaleX === 1 && scaleY === 1) {
    return build(settings);
  }

  const scaled: ContainerYardSettings = {
    ...settings,
    columnGap: settings.columnGap * scaleX,
    containerWidth: settings.containerWidth * scaleX,
    globalScale: settings.globalScale,
    lengthLong: settings.lengthLong * scaleY,
    lengthShort: settings.lengthShort * scaleY,
    offsetX: settings.offsetX * scaleX,
    offsetY: settings.offsetY * scaleY,
    rowGap: settings.rowGap * scaleY,
    shadowOffsetX: settings.shadowOffsetX * scaleX,
    shadowOffsetY: settings.shadowOffsetY * scaleY,
  };

  return build(scaled);
}

export function drawContainerYardFrame(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: ToolcraftState,
  imageData?: PreparedSourceImage | null,
): void {
  const includeBackground = shouldIncludeToolcraftPreviewBackground({ state });
  if (includeBackground) {
    context.fillStyle = readContainerYardBackgroundHex(state);
    context.fillRect(0, 0, width, height);
  }

  const settings = readContainerYardSettings(state);
  const output = buildContainerYardOutputForState(width, height, state, imageData);
  drawContainerYard(context, output, settings);
}

export function ContainerYardCanvas(): React.JSX.Element {
  const { state } = useToolcraft();
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const size = state.canvas.size;
  const settings = readContainerYardSettings(state);
  const settingsKey = JSON.stringify(settings);
  const backgroundHex = readContainerYardBackgroundHex(state);
  const includeBackground = shouldIncludeToolcraftPreviewBackground({ state });
  const renderScale = asNumber(state.values["canvas.renderScale"], 1);
  const sourceAsset = getSourceImageAsset(state.mediaAssets);
  const [sourceImageData, setSourceImageData] = React.useState<PreparedSourceImage | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    if (!sourceAsset || !isContainerYardDitherActive(settings)) {
      setSourceImageData(null);
      return () => {
        cancelled = true;
      };
    }

    void prepareSourceImageFromAsset(sourceAsset, size.width, size.height)
      .then((prepared) => {
        if (!cancelled) {
          sourceImageCache.set(
            buildSourceImageCacheKey(sourceAsset, size.width, size.height),
            prepared,
          );
          setSourceImageData(prepared);
        }
      })
      .catch((error: unknown) => {
        console.error("Container Yard failed to prepare source image.", error);
        if (!cancelled) {
          setSourceImageData(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    settings.layoutType,
    size.height,
    size.width,
    sourceAsset?.dataUrl,
    sourceAsset?.id,
    sourceAsset?.transform?.flipHorizontal,
    sourceAsset?.transform?.flipVertical,
    sourceAsset?.transform?.rotationDeg,
  ]);

  const output = React.useMemo(
    () => buildContainerYardOutputForState(size.width, size.height, state, sourceImageData),
    [settingsKey, size.height, size.width, sourceImageData, state],
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
    drawContainerYard(context, output, settings);
  }, [
    backgroundHex,
    includeBackground,
    output,
    renderScale,
    settings,
    size.height,
    size.width,
  ]);

  return (
    <>
      <AsciiGridDefaultsSync />
      <canvas
        ref={canvasRef}
        aria-hidden
        className="block size-full"
        data-toolcraft-product-canvas=""
      />
    </>
  );
}
