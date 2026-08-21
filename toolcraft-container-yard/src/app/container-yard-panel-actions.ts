import type { ToolcraftState } from "@/toolcraft/runtime";
import type { ToolcraftPanelActionContext } from "@/toolcraft/runtime/react";

import {
  buildContainerYardExportCanvasSync,
  buildContainerYardExportSvgSync,
  canvasToBlob,
  downloadCanvas,
  downloadTextAsFile,
} from "./container-yard-export";
import { isContainerYardDitherActive } from "./container-yard-math";
import { getSourceImageAsset } from "./container-yard-image-raster";
import {
  getCachedSourceImageData,
  readContainerYardSettings,
  resolveSourceImageData,
} from "./container-yard-renderer";
import { downloadContainerYardVideo } from "./container-yard-video-export";
import { isContainerYardVideoAsset } from "./container-yard-source-frame";

const exportActionValues = new Set([
  "export",
  "export-svg",
  "export-png",
  "export-jpg",
  "export-video",
  "copy-svg",
  "copy-png",
  "copy-jpg",
]);

function isCopyAction(value: string): boolean {
  return value.startsWith("copy-");
}

function readExportKind(state: ToolcraftState): "image" | "video" {
  return state.values["export.kind"] === "video" ? "video" : "image";
}

async function resolveExportImageData(state: ToolcraftState) {
  const settings = readContainerYardSettings(state);
  const asset = getSourceImageAsset(state.mediaAssets);
  if (!asset || !isContainerYardDitherActive(settings)) {
    return null;
  }

  if (isContainerYardVideoAsset(asset)) {
    return resolveSourceImageData(state);
  }

  return getCachedSourceImageData(state) ?? resolveSourceImageData(state);
}

export async function handleContainerYardPanelAction({
  action,
  dispatch,
  reportProgress,
  state,
}: ToolcraftPanelActionContext): Promise<void> {
  if (action.value === "shuffle-colors") {
    const current = typeof state.values["yard.seed"] === "number" ? state.values["yard.seed"] : 42;
    dispatch({
      target: "yard.seed",
      type: "controls.setValue",
      value: current + 1,
    });
    return;
  }

  if (!exportActionValues.has(action.value)) {
    return;
  }

  const resolvedActionValue =
    action.value === "export"
      ? readExportKind(state) === "video"
        ? "export-video"
        : (() => {
            const format = readContainerYardExportFormat(state);
            return format === "jpg" ? "export-jpg" : format === "svg" ? "export-svg" : "export-png";
          })()
      : action.value;

  if (resolvedActionValue === "export-video") {
    reportProgress(0.02);
    let peakProgress = 0.02;
    try {
      await downloadContainerYardVideo(state, (ratio) => {
        peakProgress = Math.max(peakProgress, Math.min(0.99, Math.max(0.02, ratio)));
        reportProgress(peakProgress);
      });
      reportProgress(1);
    } catch (error) {
      reportProgress(1);
      const message =
        error instanceof Error ? error.message : "Container Yard video export failed.";
      window.alert(`Video export failed.\n\n${message}`);
      throw error instanceof Error ? error : new Error(message);
    }
    return;
  }

  reportProgress(0.05);
  const format = readContainerYardExportFormat(state);
  const isCopy = isCopyAction(resolvedActionValue);
  const settings = readContainerYardSettings(state);
  const asset = getSourceImageAsset(state.mediaAssets);
  const needsAsyncImage =
    isContainerYardDitherActive(settings) &&
    asset != null &&
    (isContainerYardVideoAsset(asset) || getCachedSourceImageData(state) == null);
  let imageData = isContainerYardVideoAsset(asset) ? null : getCachedSourceImageData(state);

  if (needsAsyncImage) {
    reportProgress(0.2);
    imageData = await resolveExportImageData(state);
  }

  reportProgress(0.45);

  if (format === "svg" || resolvedActionValue === "export-svg" || resolvedActionValue === "copy-svg") {
    const svg = buildContainerYardExportSvgSync(state, imageData);
    reportProgress(0.9);

    if (isCopy || resolvedActionValue === "copy-svg") {
      await navigator.clipboard.writeText(svg);
      reportProgress(1);
      return;
    }

    downloadTextAsFile(svg, "container-yard.svg", "image/svg+xml");
    reportProgress(1);
    return;
  }

  const actionFormat =
    resolvedActionValue === "export-jpg" || resolvedActionValue === "copy-jpg"
      ? "jpg"
      : resolvedActionValue === "export-png" || resolvedActionValue === "copy-png"
        ? "png"
        : format;
  const mimeType = actionFormat === "jpg" ? "image/jpeg" : "image/png";
  const filename = actionFormat === "jpg" ? "container-yard.jpg" : "container-yard.png";
  const canvas = buildContainerYardExportCanvasSync(state, imageData);
  reportProgress(0.75);

  if (isCopy) {
    const blob = await canvasToBlob(canvas, mimeType);
    reportProgress(0.9);
    await navigator.clipboard.write([new ClipboardItem({ [mimeType]: blob })]);
    reportProgress(1);
    return;
  }

  downloadCanvas(canvas, mimeType, filename, actionFormat === "jpg" ? 0.92 : undefined);
  reportProgress(1);
}

export function readContainerYardExportFormat(state: ToolcraftState): "svg" | "png" | "jpg" {
  const format = state.values["export.image.format"];

  if (format === "png" || format === "jpg" || format === "svg") {
    return format;
  }

  return "svg";
}

export function getContainerYardExportActionLabels(format: "svg" | "png" | "jpg"): {
  copy: string;
  export: string;
} {
  switch (format) {
    case "png":
      return { copy: "Copy PNG", export: "Export PNG" };
    case "jpg":
      return { copy: "Copy JPG", export: "Export JPG" };
    default:
      return { copy: "Copy SVG", export: "Export SVG" };
  }
}
