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
import { FlowPathDevSeedApi } from "../app/flow-path-dev-seed";
import { FlowPathOverlay } from "../app/flow-path-overlay";
import {
  buildFlowOutputForState,
  drawFlowField,
  FlowFieldCanvas,
  readFlowBackgroundHex,
  readFlowColorSettings,
  readStrokeSettings,
} from "../app/flow-field-renderer";
import { buildFlowFieldSvg } from "../app/flow-field-svg-export";
import { buildShufflePatch } from "../app/flow-shuffle";
import { FlowShuffleTailSync, queueShuffleTailPatch } from "../app/flow-shuffle-tail-sync";
import { PalettePresetSync, TexturePresetSync } from "../app/texture-preset-sync";
import { createPathId } from "../app/flow-path-math";

function buildFlowExportCanvas(state: ToolcraftState): HTMLCanvasElement {
  const colorSettings = readFlowColorSettings(state);
  const strokeSettings = readStrokeSettings(state);
  const includeBackground = shouldIncludeToolcraftPreviewBackground({ state });
  const output = buildFlowOutputForState(state.canvas.size.width, state.canvas.size.height, state);

  return createToolcraftPngExportCanvas({
    background: readFlowBackgroundHex(state),
    includeBackground,
    render: ({ context, cssHeight, cssWidth }) => {
      drawFlowField(context, {
        colorSettings,
        height: cssHeight,
        output,
        strokeSettings,
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
  const colorSettings = readFlowColorSettings(state);
  const strokeSettings = readStrokeSettings(state);
  const includeBackground = shouldIncludeToolcraftPreviewBackground({ state });
  const resolution =
    typeof state.values["export.image.resolution"] === "string"
      ? state.values["export.image.resolution"]
      : undefined;
  const { height, width } = getToolcraftImageExportSize({ resolution, state });
  const output = buildFlowOutputForState(width, height, state);

  return buildFlowFieldSvg({
    backgroundHex: readFlowBackgroundHex(state),
    colorSettings,
    height,
    includeBackground,
    output,
    strokeSettings,
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
    const id = createPathId();
    const existing = state.values["paths.data"];
    const paths =
      existing && typeof existing === "object" && Array.isArray((existing as { paths?: unknown }).paths)
        ? (existing as { paths: { id: string; points: { x: number; y: number }[] }[] }).paths
        : [];
    dispatch({
      target: "paths.data",
      type: "controls.setValue",
      value: {
        activePathId: id,
        paths: [...paths, { id, points: [] }],
      },
    });
    return;
  }

  if (action.value === "delete-path") {
    const existing = state.values["paths.data"];
    if (!existing || typeof existing !== "object") {
      return;
    }
    const raw = existing as { activePathId?: string | null; paths?: { id: string; points: unknown[] }[] };
    const activeId = raw.activePathId;
    const nextPaths = (raw.paths ?? []).filter((path) => path.id !== activeId);
    dispatch({
      target: "paths.data",
      type: "controls.setValue",
      value: {
        activePathId: nextPaths[0]?.id ?? null,
        paths: nextPaths,
      },
    });
    return;
  }

  if (action.value === "randomize-seed") {
    const current =
      typeof state.values["flow.seed"] === "number" ? state.values["flow.seed"] : 21;
    dispatch({
      target: "flow.seed",
      type: "controls.setValue",
      value: (current + 137) % 10000,
    });
    return;
  }

  if (action.value === "shuffle") {
    const currentSeed =
      typeof state.values["flow.seed"] === "number" ? state.values["flow.seed"] : 21;
    const patch = buildShufflePatch(currentSeed);
    dispatch({
      target: "flow.seed",
      type: "controls.setValue",
      value: patch["flow.seed"],
    });
    queueMicrotask(() => {
      dispatch({
        target: "color.palette",
        type: "controls.setValue",
        value: patch["color.palette"],
      });
      dispatch({
        target: "flow.pattern",
        type: "controls.setValue",
        value: patch["flow.pattern"],
      });
      dispatch({
        target: "flow.snapAngles",
        type: "controls.setValue",
        value: patch["flow.snapAngles"],
      });
    });
    queueShuffleTailPatch({
      "streams.spacingMode": patch["streams.spacingMode"],
      "stroke.sizeVariety": patch["stroke.sizeVariety"],
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

function FlowFieldCanvasWithPaths(): React.JSX.Element {
  const { state } = useToolcraft();
  const { height, width } = state.canvas.size;

  return (
    <div className="relative size-full" data-toolcraft-product-output="">
      <TexturePresetSync />
      <PalettePresetSync />
      <FlowShuffleTailSync />
      <FlowPathDevSeedApi />
      <FlowFieldCanvas />
      <FlowPathOverlay canvasHeight={height} canvasWidth={width} />
    </div>
  );
}

export function AppHome(): React.JSX.Element {
  return (
    <ToolcraftApp
      canvasContent={<FlowFieldCanvasWithPaths />}
      className="h-dvh min-h-dvh"
      onPanelAction={handlePanelAction}
      renderDefaultCanvasMedia={false}
      schema={appSchema}
    />
  );
}
