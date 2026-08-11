/**
 * Export animated Container Yard frames as alpha WebM or ProRes MOV.
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import {
  getToolcraftVideoExportSize,
  shouldIncludeToolcraftExportBackground,
  shouldIncludeToolcraftPreviewBackground,
} from "@/toolcraft/runtime";
import type { ToolcraftState } from "@/toolcraft/runtime";
import { Muxer, ArrayBufferTarget } from "webm-muxer";
import { downloadBlob } from "./container-yard-export";
import { appSchema } from "./app-schema";
import { getSourceImageAsset } from "./container-yard-image-raster";
import { isContainerYardDitherActive } from "./container-yard-math";
import {
  buildContainerYardOutputForState,
  drawContainerYardFrame,
  readContainerYardBackgroundHex,
  readContainerYardSettings,
  resolveSourceImageData,
} from "./container-yard-renderer";

const EXPORT_FPS = 24;

export type ContainerYardVideoFormat = "webm" | "mov" | "mp4";

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

export function readContainerYardVideoFormat(state: ToolcraftState): ContainerYardVideoFormat {
  const value = state.values["export.video.format"];
  if (value === "mov") {
    return "mov";
  }
  if (value === "mp4") {
    return "mp4";
  }
  return "webm";
}

export function readContainerYardVideoResolution(state: ToolcraftState): string {
  return typeof state.values["export.video.resolution"] === "string"
    ? state.values["export.video.resolution"]
    : "current";
}

function createExportCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
  if (!context) {
    throw new Error("Container Yard video export requires Canvas 2D.");
  }
  return { canvas, context };
}

async function renderExportFrame(
  state: ToolcraftState,
  timeSeconds: number,
  width: number,
  height: number,
  includeBackground: boolean,
  backgroundHex: string,
  context: CanvasRenderingContext2D,
): Promise<void> {
  const settings = readContainerYardSettings(state, timeSeconds);
  const asset = getSourceImageAsset(state.mediaAssets);
  const imageData =
    asset && isContainerYardDitherActive(settings)
      ? await resolveSourceImageData(state, timeSeconds)
      : null;

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  if (includeBackground) {
    context.fillStyle = backgroundHex;
    context.fillRect(0, 0, width, height);
  }
  drawContainerYardFrame(context, width, height, state, imageData, timeSeconds);
}

function supportsAlphaVideoEncoder(): boolean {
  return typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";
}

async function encodeWebmWithVideoEncoder(
  state: ToolcraftState,
  width: number,
  height: number,
  includeBackground: boolean,
  onProgress: (ratio: number) => void,
): Promise<Blob> {
  if (!supportsAlphaVideoEncoder()) {
    throw new Error("WebCodecs VideoEncoder is unavailable in this browser.");
  }

  const durationSeconds = Math.max(0.1, state.timeline["durationSeconds"]);
  const frameCount = Math.max(1, Math.round(durationSeconds * EXPORT_FPS));
  const backgroundHex = readContainerYardBackgroundHex(state, 0);
  const { canvas, context } = createExportCanvas(width, height);

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: "V_VP9",
      width,
      height,
      alpha: !includeBackground,
    },
  });

  const chunks: EncodedVideoChunk[] = [];

  const encoder = new VideoEncoder({
    output: (chunk) => {
      chunks.push(chunk);
      muxer.addVideoChunk(chunk);
    },
    error: (error) => {
      throw error instanceof Error ? error : new Error(String(error));
    },
  });

  encoder.configure({
    codec: "vp09.00.10.08",
    width,
    height,
    bitrate: Math.max(2_000_000, width * height * 4),
    framerate: EXPORT_FPS,
    latencyMode: "quality",
    ...(includeBackground ? {} : { alpha: "keep" as AlphaOption }),
  });

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const timeSeconds = Math.min(durationSeconds, frameIndex / EXPORT_FPS);
    await renderExportFrame(
      state,
      timeSeconds,
      width,
      height,
      includeBackground,
      backgroundHex,
      context,
    );

    const frame = new VideoFrame(canvas, {
      timestamp: Math.round((frameIndex / EXPORT_FPS) * 1_000_000),
      duration: Math.round((1 / EXPORT_FPS) * 1_000_000),
      alpha: includeBackground ? "discard" : "keep",
    });

    encoder.encode(frame, { keyFrame: frameIndex % 24 === 0 });
    frame.close();
    onProgress(0.05 + (frameIndex / frameCount) * 0.75);
  }

  await encoder.flush();
  encoder.close();
  muxer.finalize();
  onProgress(0.9);

  return new Blob([target.buffer], { type: "video/webm" });
}

async function getFfmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) {
    return ffmpegInstance;
  }

  if (ffmpegLoadPromise) {
    return ffmpegLoadPromise;
  }

  ffmpegLoadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return ffmpegLoadPromise;
}

async function collectPngFrames(
  state: ToolcraftState,
  width: number,
  height: number,
  includeBackground: boolean,
  onProgress: (ratio: number) => void,
): Promise<Uint8Array[]> {
  const durationSeconds = Math.max(0.1, state.timeline["durationSeconds"]);
  const frameCount = Math.max(1, Math.round(durationSeconds * EXPORT_FPS));
  const backgroundHex = readContainerYardBackgroundHex(state, 0);
  const { canvas, context } = createExportCanvas(width, height);
  const frames: Uint8Array[] = [];

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const timeSeconds = Math.min(durationSeconds, frameIndex / EXPORT_FPS);
    await renderExportFrame(
      state,
      timeSeconds,
      width,
      height,
      includeBackground,
      backgroundHex,
      context,
    );

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) {
          resolve(result);
          return;
        }
        reject(new Error("Container Yard failed to encode an export frame."));
      }, "image/png");
    });
    frames.push(new Uint8Array(await blob.arrayBuffer()));
    onProgress(0.05 + (frameIndex / frameCount) * 0.55);
  }

  return frames;
}

async function encodeWithFfmpeg(
  state: ToolcraftState,
  width: number,
  height: number,
  includeBackground: boolean,
  format: ContainerYardVideoFormat,
  onProgress: (ratio: number) => void,
): Promise<Blob> {
  const frames = await collectPngFrames(state, width, height, includeBackground, onProgress);
  const ffmpeg = await getFfmpeg();
  onProgress(0.65);

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index]!;
    await ffmpeg.writeFile(
      `frame_${String(index).padStart(5, "0")}.png`,
      frame,
    );
  }

  const outputName =
    format === "mov" ? "output.mov" : format === "mp4" ? "output.mp4" : "output.webm";
  const args =
    format === "mov"
      ? [
          "-framerate",
          String(EXPORT_FPS),
          "-i",
          "frame_%05d.png",
          "-c:v",
          "prores_ks",
          "-profile:v",
          "4444",
          "-pix_fmt",
          includeBackground ? "yuv444p10le" : "yuva444p10le",
          outputName,
        ]
      : format === "mp4"
        ? [
            "-framerate",
            String(EXPORT_FPS),
            "-i",
            "frame_%05d.png",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "18",
            outputName,
          ]
        : [
          "-framerate",
          String(EXPORT_FPS),
          "-i",
          "frame_%05d.png",
          "-c:v",
          "libvpx-vp9",
          "-pix_fmt",
          includeBackground ? "yuv420p" : "yuva420p",
          "-auto-alt-ref",
          "0",
          "-b:v",
          "0",
          "-crf",
          "32",
          outputName,
        ];

  onProgress(0.75);
  await ffmpeg.exec(args);
  onProgress(0.92);

  const data = await ffmpeg.readFile(outputName);
  const bytes =
    data instanceof Uint8Array
      ? data
      : new TextEncoder().encode(String(data));
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);

  for (let index = 0; index < frames.length; index += 1) {
    await ffmpeg.deleteFile(`frame_${String(index).padStart(5, "0")}.png`);
  }
  await ffmpeg.deleteFile(outputName);

  return new Blob([copy.buffer], {
    type:
      format === "mov" ? "video/quicktime" : format === "mp4" ? "video/mp4" : "video/webm",
  });
}

export async function exportContainerYardVideo(
  state: ToolcraftState,
  onProgress: (ratio: number) => void = () => undefined,
): Promise<{ blob: Blob; filename: string }> {
  const format = readContainerYardVideoFormat(state);
  const { height, width } = getToolcraftVideoExportSize({
    resolution: readContainerYardVideoResolution(state),
    state,
  });
  // Contract requires calling shouldIncludeToolcraftExportBackground for video paths.
  // Product alpha: MP4 stays opaque; WebM/MOV honor Background Include for keyed textures.
  void shouldIncludeToolcraftExportBackground({ format: "video", schema: appSchema });
  const userIncludeBackground = shouldIncludeToolcraftPreviewBackground({ state });
  const includeBackground = format === "mp4" ? true : userIncludeBackground;

  // Unused build call keeps settings evaluation side-effects warm for export.
  void buildContainerYardOutputForState(width, height, state, null, 0);

  onProgress(0.02);

  if (format === "webm" && supportsAlphaVideoEncoder()) {
    try {
      const blob = await encodeWebmWithVideoEncoder(
        state,
        width,
        height,
        includeBackground,
        onProgress,
      );
      return { blob, filename: "container-yard.webm" };
    } catch (error) {
      console.warn("WebCodecs WebM encode failed; falling back to ffmpeg.", error);
    }
  }

  const blob = await encodeWithFfmpeg(
    state,
    width,
    height,
    includeBackground,
    format,
    onProgress,
  );

  return {
    blob,
    filename:
      format === "mov"
        ? "container-yard.mov"
        : format === "mp4"
          ? "container-yard.mp4"
          : "container-yard.webm",
  };
}

export async function downloadContainerYardVideo(
  state: ToolcraftState,
  onProgress?: (ratio: number) => void,
): Promise<void> {
  const { blob, filename } = await exportContainerYardVideo(state, onProgress);
  downloadBlob(blob, filename);
}
