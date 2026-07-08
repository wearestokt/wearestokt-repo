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
import { createPathId } from "../app/flow-path-math";
import { FlowPathDevSeedApi } from "../app/flow-path-dev-seed";
import { FlowPathOverlay } from "../app/flow-path-overlay";
import {
  buildWordTideLayoutForState,
  drawWordTide,
  getPreparedSourceImageForState,
  getShapeMaskForState,
  readTideBackgroundHex,
  readWordTideSettings,
  WordTideCanvas,
  type WordTideLayout,
} from "../app/word-tide-renderer";
import { buildWordTideSvg, buildWordTideSvgOutlined } from "../app/word-tide-svg-export";

function buildExportLayout(state: ToolcraftState): WordTideLayout {
  const { image, key: imageKey } = getPreparedSourceImageForState(state);
  const { key: maskKey, mask } = getShapeMaskForState(state);
  return buildWordTideLayoutForState(state, image, imageKey, mask, maskKey);
}

function buildWordTideExportCanvas(state: ToolcraftState): HTMLCanvasElement {
  const settings = readWordTideSettings(state);
  const includeBackground = shouldIncludeToolcraftPreviewBackground({ state });
  const layout = buildExportLayout(state);

  return createToolcraftPngExportCanvas({
    background: readTideBackgroundHex(state),
    includeBackground,
    render: ({ context }) => {
      drawWordTide(context, {
        highlightColor: settings.highlightColor,
        layout,
      });
    },
    resolution:
      typeof state.values["export.image.resolution"] === "string"
        ? (state.values["export.image.resolution"] as string)
        : undefined,
    state,
  });
}

async function buildWordTideExportSvg(state: ToolcraftState): Promise<string> {
  const settings = readWordTideSettings(state);
  const includeBackground = shouldIncludeToolcraftPreviewBackground({ state });
  const resolution =
    typeof state.values["export.image.resolution"] === "string"
      ? state.values["export.image.resolution"]
      : undefined;
  const { height, width } = getToolcraftImageExportSize({ resolution, state });
  const layout = buildExportLayout(state);
  const textMode = state.values["export.svg.text"] === "outlines" ? "outlines" : "editable";

  const options = {
    backgroundHex: readTideBackgroundHex(state),
    height,
    highlightColor: settings.highlightColor,
    includeBackground,
    layout,
    textMode,
    width,
  } as const;

  if (textMode === "outlines") {
    return buildWordTideSvgOutlined(options);
  }
  return buildWordTideSvg(options);
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Word Tide export produced no image blob."));
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
  if (action.value === "randomize-seed") {
    const current =
      typeof state.values["tide.seed"] === "number" ? state.values["tide.seed"] : 21;
    dispatch({
      target: "tide.seed",
      type: "controls.setValue",
      value: (current + 137) % 10000,
    });
    return;
  }

  if (action.value === "add-path") {
    const id = createPathId();
    const existing = state.values["paths.data"];
    const paths =
      existing &&
      typeof existing === "object" &&
      Array.isArray((existing as { paths?: unknown }).paths)
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
    const raw = existing as {
      activePathId?: string | null;
      paths?: { id: string; points: unknown[] }[];
    };
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

  if (action.value !== "export-image" && action.value !== "copy-image") {
    return;
  }

  reportProgress(0.1);
  const format = state.values["export.image.format"];
  const isSvg = format === "svg";
  const isJpg = format === "jpg";

  if (isSvg) {
    const svg = await buildWordTideExportSvg(state);
    reportProgress(0.85);

    if (action.value === "copy-image") {
      await navigator.clipboard.writeText(svg);
      reportProgress(1);
      return;
    }

    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), "word-tide.svg");
    reportProgress(1);
    return;
  }

  const mimeType = isJpg ? "image/jpeg" : "image/png";
  const canvas = buildWordTideExportCanvas(state);
  reportProgress(0.6);
  const blob = await canvasToBlob(canvas, mimeType);
  reportProgress(0.85);

  if (action.value === "copy-image") {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    reportProgress(1);
    return;
  }

  downloadBlob(blob, isJpg ? "word-tide.jpg" : "word-tide.png");
  reportProgress(1);
}

function WordTideCanvasWithPaths(): React.JSX.Element {
  const { state } = useToolcraft();
  const { height, width } = state.canvas.size;
  const isFlowMode = state.values["mode.render"] !== "dither";

  return (
    <div className="relative size-full" data-toolcraft-product-output="">
      <FlowPathDevSeedApi />
      <WordTideCanvas />
      {isFlowMode ? <FlowPathOverlay canvasHeight={height} canvasWidth={width} /> : null}
    </div>
  );
}

export function AppHome(): React.JSX.Element {
  return (
    <ToolcraftApp
      canvasContent={<WordTideCanvasWithPaths />}
      className="h-dvh min-h-dvh"
      onPanelAction={handlePanelAction}
      renderDefaultCanvasMedia={false}
      schema={appSchema}
    />
  );
}
