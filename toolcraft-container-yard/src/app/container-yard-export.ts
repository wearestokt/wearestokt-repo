import {
  createToolcraftPngExportCanvas,
  getToolcraftImageExportSize,
  shouldIncludeToolcraftPreviewBackground,
} from "@/toolcraft/runtime";
import type { ToolcraftState } from "@/toolcraft/runtime";

import {
  buildContainerYardOutputForState,
  drawContainerYardFrame,
  readContainerYardBackgroundHex,
  readContainerYardSettings,
  resolveSourceImageData,
} from "./container-yard-renderer";
import type { PreparedSourceImage } from "./container-yard-math";
import { buildContainerYardSvg } from "./container-yard-svg-export";

function readExportResolution(state: ToolcraftState): string | undefined {
  return typeof state.values["export.image.resolution"] === "string"
    ? state.values["export.image.resolution"]
    : undefined;
}

export function buildContainerYardExportSvgSync(
  state: ToolcraftState,
  imageData?: PreparedSourceImage | null,
): string {
  const settings = readContainerYardSettings(state);
  const includeBackground = shouldIncludeToolcraftPreviewBackground({ state });
  const { height, width } = getToolcraftImageExportSize({
    resolution: readExportResolution(state),
    state,
  });
  const output = buildContainerYardOutputForState(width, height, state, imageData);

  return buildContainerYardSvg({
    backgroundHex: readContainerYardBackgroundHex(state),
    height,
    includeBackground,
    output,
    settings,
    width,
  });
}

export function buildContainerYardExportCanvasSync(
  state: ToolcraftState,
  imageData?: PreparedSourceImage | null,
): HTMLCanvasElement {
  const includeBackground = shouldIncludeToolcraftPreviewBackground({ state });
  const imageResolution =
    typeof state.values["export.image.resolution"] === "string"
      ? state.values["export.image.resolution"]
      : undefined;

  return createToolcraftPngExportCanvas({
    background: readContainerYardBackgroundHex(state),
    includeBackground,
    render: ({ context, cssHeight, cssWidth }) => {
      drawContainerYardFrame(context, cssWidth, cssHeight, state, imageData);
    },
    resolution: imageResolution,
    state,
  });
}

/** @deprecated Prefer sync builders with cached image data for user-gesture-safe export. */
export async function buildContainerYardExportCanvas(state: ToolcraftState): Promise<HTMLCanvasElement> {
  const imageData = await resolveSourceImageData(state);
  return buildContainerYardExportCanvasSync(state, imageData);
}

/** @deprecated Prefer sync builders with cached image data for user-gesture-safe export. */
export async function buildContainerYardExportSvg(state: ToolcraftState): Promise<string> {
  const imageData = await resolveSourceImageData(state);
  return buildContainerYardExportSvgSync(state, imageData);
}

export function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Toolcraft container-yard export produced no image blob."));
    }, mimeType);
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadTextAsFile(content: string, filename: string, mimeType: string): void {
  downloadBlob(new Blob([content], { type: mimeType }), filename);
}

export function downloadCanvas(
  canvas: HTMLCanvasElement,
  mimeType: string,
  filename: string,
  quality?: number,
): void {
  const dataUrl =
    typeof quality === "number"
      ? canvas.toDataURL(mimeType, quality)
      : canvas.toDataURL(mimeType);
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
