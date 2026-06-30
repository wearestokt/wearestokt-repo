import {
  createToolcraftPngExportCanvas,
  getToolcraftImageExportSize,
  shouldIncludeToolcraftPreviewBackground,
} from "@/toolcraft/runtime";
import type { ToolcraftState } from "@/toolcraft/runtime";
import {
  ToolcraftApp,
  type ToolcraftPanelActionContext,
  useToolcraft,
} from "@/toolcraft/runtime/react";

import { appSchema } from "../app/app-schema";
import {
  addGuidePath,
  deleteActiveGuidePath,
  FlowGuideOverlay,
} from "../app/flow-guide-overlay";
import {
  buildFlowGlyphsForState,
  drawFlowField,
  FlowFieldCanvas,
  readFlowBackgroundHex,
  readFlowFieldSettings,
  readFlowMarkerColor,
} from "../app/flow-field-renderer";
import { buildFlowFieldSvg } from "../app/flow-field-svg-export";

function buildFlowExportCanvas(state: ToolcraftState): HTMLCanvasElement {
  const settings = readFlowFieldSettings(state);
  const color = readFlowMarkerColor(state);
  const includeBackground = shouldIncludeToolcraftPreviewBackground({ state });
  const glyphs = buildFlowGlyphsForState(state.canvas.size.width, state.canvas.size.height, state);

  return createToolcraftPngExportCanvas({
    background: readFlowBackgroundHex(state),
    includeBackground,
    render: ({ context, cssHeight, cssWidth }) => {
      drawFlowField(context, {
        color,
        glyphs,
        height: cssHeight,
        settings,
        width: cssWidth,
      });
    },
    resolution:
      typeof state.values["export.image.resolution"] === "string"
        ? (state.values["export.image.resolution"] as string)
        : undefined,
    state,
  });
}

function buildFlowExportSvg(state: ToolcraftState): string {
  const settings = readFlowFieldSettings(state);
  const color = readFlowMarkerColor(state);
  const includeBackground = shouldIncludeToolcraftPreviewBackground({ state });
  const resolution =
    typeof state.values["export.image.resolution"] === "string"
      ? state.values["export.image.resolution"]
      : undefined;
  const { height, width } = getToolcraftImageExportSize({
    resolution,
    state,
  });
  const glyphs = buildFlowGlyphsForState(width, height, state);

  return buildFlowFieldSvg({
    backgroundHex: readFlowBackgroundHex(state),
    color,
    glyphs,
    height,
    includeBackground,
    settings,
    width,
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Toolcraft flow-field export produced no image blob."));
    }, mimeType);
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function handlePanelAction({
  action,
  dispatch,
  reportProgress,
  state,
}: ToolcraftPanelActionContext): Promise<void> {
  if (action.value === "add-path") {
    dispatch({
      target: "guides.paths",
      type: "controls.setValue",
      value: addGuidePath(state),
    });
    return;
  }

  if (action.value === "delete-path") {
    dispatch({
      target: "guides.paths",
      type: "controls.setValue",
      value: deleteActiveGuidePath(state),
    });
    return;
  }

  if (action.value !== "export-png" && action.value !== "copy-png") {
    return;
  }

  reportProgress(0.1);
  const format = state.values["export.image.format"];
  const isSvg = format === "svg";
  const isJpg = format === "jpg";

  if (isSvg) {
    const svg = buildFlowExportSvg(state);
    reportProgress(0.85);
    const blob = new Blob([svg], { type: "image/svg+xml" });

    if (action.value === "copy-png") {
      await navigator.clipboard.writeText(svg);
      reportProgress(1);
      return;
    }

    downloadBlob(blob, "flow-field.svg");
    reportProgress(1);
    return;
  }

  const mimeType = isJpg ? "image/jpeg" : "image/png";
  const canvas = buildFlowExportCanvas(state);
  reportProgress(0.6);
  const blob = await canvasToBlob(canvas, mimeType);
  reportProgress(0.85);

  if (action.value === "copy-png") {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    reportProgress(1);
    return;
  }

  downloadBlob(blob, isJpg ? "flow-field.jpg" : "flow-field.png");
  reportProgress(1);
}

function FlowFieldCanvasWithGuides(): React.JSX.Element {
  const { state } = useToolcraft();
  const { height, width } = state.canvas.size;

  return (
    <div className="relative size-full" data-toolcraft-product-output="">
      <FlowFieldCanvas />
      <FlowGuideOverlay canvasHeight={height} canvasWidth={width} />
    </div>
  );
}

export function AppHome(): React.JSX.Element {
  return (
    <ToolcraftApp
      canvasContent={<FlowFieldCanvasWithGuides />}
      className="h-dvh min-h-dvh"
      onPanelAction={handlePanelAction}
      renderDefaultCanvasMedia={false}
      schema={appSchema}
    />
  );
}
