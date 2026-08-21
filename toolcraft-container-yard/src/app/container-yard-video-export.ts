/**
 * Export animated Container Yard frames as MP4 / alpha WebM / ProRes MOV.
 *
 * Preference order for MP4:
 * 1. WebCodecs VideoEncoder + mp4-muxer (timeline timestamps, high bitrate)
 * 2. ffmpeg.wasm
 * 3. MediaRecorder last (wall-clock duration; avoid for ASCII)
 *
 * Preference order for WebM:
 * 1. WebCodecs VideoEncoder + webm-muxer (timestamp-accurate, alpha when supported)
 * 2. MediaRecorder + canvas.captureStream(0) + requestFrame (browser baseline)
 * 3. ffmpeg.wasm from local @ffmpeg/core (offline re-encode)
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import {
  getToolcraftVideoExportSize,
  shouldIncludeToolcraftExportBackground,
  shouldIncludeToolcraftPreviewBackground,
} from "@/toolcraft/runtime";
import type { ToolcraftState } from "@/toolcraft/runtime";
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmArrayBufferTarget } from "webm-muxer";
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4ArrayBufferTarget } from "mp4-muxer";
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
const ENCODER_STALL_TIMEOUT_MS = 20_000;
const FFMPEG_LOAD_TIMEOUT_MS = 25_000;
const RECORDER_STOP_TIMEOUT_MS = 8_000;

export type ContainerYardVideoFormat = "webm" | "mov" | "mp4";

function exportVideoBitrate(width: number, height: number): number {
  return Math.min(50_000_000, Math.max(16_000_000, width * height * 10));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function yieldToUi(): Promise<void> {
  return delay(0);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer = 0;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => {
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    window.clearTimeout(timer);
  }
}

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

export function readContainerYardVideoFormat(state: ToolcraftState): ContainerYardVideoFormat {
  const value = state.values["export.video.format"];
  if (value === "mov") {
    return "mov";
  }
  if (value === "webm") {
    return "webm";
  }
  return "mp4";
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
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    throw new Error("Container Yard video export requires Canvas 2D.");
  }
  context.imageSmoothingEnabled = false;
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

function getExportTimeline(state: ToolcraftState): { durationSeconds: number; frameCount: number } {
  const durationSeconds = Math.max(0.1, state.timeline["durationSeconds"]);
  const frameCount = Math.max(1, Math.round(durationSeconds * EXPORT_FPS));
  return { durationSeconds, frameCount };
}

function pickSupportedWebmMimeType(): string | null {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return null;
  }

  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

function pickSupportedMp4MimeType(): string | null {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return null;
  }

  const candidates = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4;codecs=avc1",
    "video/mp4",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

type WebCodecsPlan = {
  alpha: boolean;
  codec: string;
  muxerCodec: "V_VP9" | "V_VP8" | "V_AV1";
};

async function pickWebCodecsPlan(
  width: number,
  height: number,
  wantAlpha: boolean,
): Promise<WebCodecsPlan | null> {
  if (typeof VideoEncoder === "undefined" || typeof VideoEncoder.isConfigSupported !== "function") {
    return null;
  }

  const candidates: WebCodecsPlan[] = [
    ...(wantAlpha
      ? ([
          { alpha: true, codec: "vp09.00.10.08", muxerCodec: "V_VP9" },
          { alpha: true, codec: "vp09.02.10.10", muxerCodec: "V_VP9" },
        ] as const)
      : []),
    { alpha: false, codec: "vp09.00.10.08", muxerCodec: "V_VP9" },
    { alpha: false, codec: "vp8", muxerCodec: "V_VP8" },
    { alpha: false, codec: "av01.0.04M.08", muxerCodec: "V_AV1" },
  ];

  for (const candidate of candidates) {
    const support = await VideoEncoder.isConfigSupported({
      codec: candidate.codec,
      width,
      height,
      bitrate: exportVideoBitrate(width, height),
      framerate: EXPORT_FPS,
      latencyMode: "quality",
      ...(candidate.alpha ? { alpha: "keep" as AlphaOption } : {}),
    });
    if (support.supported) {
      return candidate;
    }
  }

  return null;
}

async function encodeWebmWithVideoEncoder(
  state: ToolcraftState,
  width: number,
  height: number,
  includeBackground: boolean,
  onProgress: (ratio: number) => void,
): Promise<Blob> {
  const plan = await pickWebCodecsPlan(width, height, !includeBackground);
  if (!plan) {
    throw new Error("WebCodecs VideoEncoder has no supported WebM config in this browser.");
  }

  // If alpha was requested but only an opaque config is available, composite on a solid background.
  const encodeWithBackground = includeBackground || !plan.alpha;
  const { durationSeconds, frameCount } = getExportTimeline(state);
  const backgroundHex = readContainerYardBackgroundHex(state, 0);
  const { canvas, context } = createExportCanvas(width, height);

  const target = new WebmArrayBufferTarget();
  const muxer = new WebmMuxer({
    target,
    video: {
      codec: plan.muxerCodec,
      width,
      height,
      alpha: plan.alpha && !encodeWithBackground,
    },
  });

  let rejectEncoding: ((error: Error) => void) | null = null;
  const encodingFailed = new Promise<never>((_, reject) => {
    rejectEncoding = reject;
  });

  const encoder = new VideoEncoder({
    output: (chunk) => {
      muxer.addVideoChunk(chunk);
    },
    error: (error) => {
      const normalized = error instanceof Error ? error : new Error(String(error));
      // Explicit throw/reject so scanners and callers see encoder failures.
      if (rejectEncoding) {
        rejectEncoding(normalized);
      }
      throw normalized;
    },
  });

  encoder.configure({
    codec: plan.codec,
    width,
    height,
    bitrate: exportVideoBitrate(width, height),
    framerate: EXPORT_FPS,
    latencyMode: "quality",
    ...(plan.alpha && !encodeWithBackground ? { alpha: "keep" as AlphaOption } : {}),
  });

  try {
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const timeSeconds = Math.min(durationSeconds, frameIndex / EXPORT_FPS);
      await renderExportFrame(
        state,
        timeSeconds,
        width,
        height,
        encodeWithBackground,
        backgroundHex,
        context,
      );

      const queueWaitDeadline = Date.now() + ENCODER_STALL_TIMEOUT_MS;
      while (encoder.encodeQueueSize > 4) {
        if (Date.now() > queueWaitDeadline) {
          throw new Error("VideoEncoder stalled while encoding Container Yard video.");
        }
        await Promise.race([encodingFailed, delay(8)]);
      }

      const frame = new VideoFrame(canvas, {
        timestamp: Math.round((frameIndex / EXPORT_FPS) * 1_000_000),
        duration: Math.round((1 / EXPORT_FPS) * 1_000_000),
        alpha: encodeWithBackground ? "discard" : "keep",
      });

      try {
        encoder.encode(frame, { keyFrame: frameIndex % 24 === 0 });
      } finally {
        frame.close();
      }
      onProgress(0.05 + (frameIndex / frameCount) * 0.75);
      await yieldToUi();
    }

    await withTimeout(
      Promise.race([encoder.flush(), encodingFailed]),
      ENCODER_STALL_TIMEOUT_MS,
      "VideoEncoder flush stalled while encoding Container Yard video.",
    );
  } finally {
    if (encoder.state !== "closed") {
      encoder.close();
    }
  }

  muxer.finalize();
  onProgress(0.9);
  return new Blob([target.buffer], { type: "video/webm" });
}

async function pickAvcPlan(width: number, height: number): Promise<string | null> {
  if (typeof VideoEncoder === "undefined" || typeof VideoEncoder.isConfigSupported !== "function") {
    return null;
  }

  const candidates = ["avc1.640028", "avc1.4d0028", "avc1.42001f"];
  const bitrate = exportVideoBitrate(width, height);

  for (const codec of candidates) {
    const support = await VideoEncoder.isConfigSupported({
      codec,
      width,
      height,
      bitrate,
      framerate: EXPORT_FPS,
      latencyMode: "quality",
    });
    if (support.supported) {
      return codec;
    }
  }

  return null;
}

async function encodeMp4WithVideoEncoder(
  state: ToolcraftState,
  width: number,
  height: number,
  includeBackground: boolean,
  onProgress: (ratio: number) => void,
): Promise<Blob> {
  const codec = await pickAvcPlan(width, height);
  if (!codec) {
    throw new Error("WebCodecs VideoEncoder has no supported MP4/AVC config in this browser.");
  }

  const { durationSeconds, frameCount } = getExportTimeline(state);
  const backgroundHex = readContainerYardBackgroundHex(state, 0);
  const { canvas, context } = createExportCanvas(width, height);
  const target = new Mp4ArrayBufferTarget();
  const muxer = new Mp4Muxer({
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
    target,
    video: {
      codec: "avc",
      height,
      width,
    },
  });

  let rejectEncoding: ((error: Error) => void) | null = null;
  const encodingFailed = new Promise<never>((_, reject) => {
    rejectEncoding = reject;
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (error) => {
      const normalized = error instanceof Error ? error : new Error(String(error));
      if (rejectEncoding) {
        rejectEncoding(normalized);
      }
      throw normalized;
    },
  });

  encoder.configure({
    bitrate: exportVideoBitrate(width, height),
    codec,
    framerate: EXPORT_FPS,
    height,
    latencyMode: "quality",
    width,
  });

  try {
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

      const queueWaitDeadline = Date.now() + ENCODER_STALL_TIMEOUT_MS;
      while (encoder.encodeQueueSize > 4) {
        if (Date.now() > queueWaitDeadline) {
          throw new Error("VideoEncoder stalled while encoding Container Yard MP4.");
        }
        await Promise.race([encodingFailed, delay(8)]);
      }

      const frame = new VideoFrame(canvas, {
        duration: Math.round((1 / EXPORT_FPS) * 1_000_000),
        timestamp: Math.round((frameIndex / EXPORT_FPS) * 1_000_000),
      });

      try {
        encoder.encode(frame, { keyFrame: frameIndex % 24 === 0 });
      } finally {
        frame.close();
      }
      onProgress(0.05 + (frameIndex / frameCount) * 0.75);
      await yieldToUi();
    }

    await withTimeout(
      Promise.race([encoder.flush(), encodingFailed]),
      ENCODER_STALL_TIMEOUT_MS,
      "VideoEncoder flush stalled while encoding Container Yard MP4.",
    );
  } finally {
    if (encoder.state !== "closed") {
      encoder.close();
    }
  }

  muxer.finalize();
  onProgress(0.9);
  return new Blob([target.buffer], { type: "video/mp4" });
}

async function encodeWithMediaRecorder(
  state: ToolcraftState,
  width: number,
  height: number,
  includeBackground: boolean,
  mimeType: string,
  onProgress: (ratio: number) => void,
): Promise<Blob> {
  const { durationSeconds, frameCount } = getExportTimeline(state);
  const backgroundHex = readContainerYardBackgroundHex(state, 0);
  const canvas = document.createElement("canvas");
  // Contract: set canvas dimensions before captureStream/MediaRecorder setup.
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
  if (!context) {
    throw new Error("Container Yard video export requires Canvas 2D.");
  }
  // captureStream(0) only emits when requestFrame() is called.
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;
  if (!track || typeof track.requestFrame !== "function") {
    stream.getTracks().forEach((item) => item.stop());
    throw new Error("CanvasCaptureMediaStreamTrack.requestFrame is unavailable in this browser.");
  }

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: exportVideoBitrate(width, height),
  });
  const chunks: Blob[] = [];

  const recording = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => {
      reject(new Error("MediaRecorder failed while encoding Container Yard video."));
    };
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType.includes("mp4") ? "video/mp4" : "video/webm" }));
    };
  });

  recorder.start(100);

  try {
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
      track.requestFrame();
      onProgress(0.05 + (frameIndex / frameCount) * 0.85);
      await delay(Math.round(1000 / EXPORT_FPS));
    }

    await delay(120);
    if (recorder.state !== "inactive") {
      recorder.stop();
    }

    const blob = await withTimeout(
      recording,
      RECORDER_STOP_TIMEOUT_MS,
      "MediaRecorder stalled while finishing Container Yard video.",
    );
    onProgress(0.95);
    return blob;
  } catch (error) {
    if (recorder.state !== "inactive") {
      recorder.stop();
    }
    throw error;
  } finally {
    stream.getTracks().forEach((item) => item.stop());
  }
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
    const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
    const coreURL = await withTimeout(
      toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      FFMPEG_LOAD_TIMEOUT_MS,
      "Timed out downloading ffmpeg.wasm.",
    );
    const wasmURL = await withTimeout(
      toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      FFMPEG_LOAD_TIMEOUT_MS,
      "Timed out downloading ffmpeg.wasm.",
    );
    await withTimeout(
      ffmpeg.load({ coreURL, wasmURL }),
      FFMPEG_LOAD_TIMEOUT_MS,
      "Timed out loading ffmpeg.wasm.",
    );
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })().catch((error: unknown) => {
    ffmpegLoadPromise = null;
    throw error instanceof Error
      ? error
      : new Error(`Failed to load ffmpeg.wasm: ${String(error)}`);
  });

  return ffmpegLoadPromise;
}

async function collectPngFrames(
  state: ToolcraftState,
  width: number,
  height: number,
  includeBackground: boolean,
  onProgress: (ratio: number) => void,
): Promise<Uint8Array[]> {
  const { durationSeconds, frameCount } = getExportTimeline(state);
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
    await yieldToUi();
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
    await ffmpeg.writeFile(`frame_${String(index).padStart(5, "0")}.png`, frame);
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
            "-movflags",
            "+faststart",
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
  const encodeBudgetMs = Math.max(60_000, frames.length * 1_200);
  const code = await withTimeout(
    ffmpeg.exec(args),
    encodeBudgetMs,
    `Timed out encoding ${format.toUpperCase()} with ffmpeg.wasm.`,
  );
  if (code !== 0) {
    throw new Error(`ffmpeg exited with code ${code} while encoding ${format.toUpperCase()}.`);
  }
  onProgress(0.92);

  const data = await ffmpeg.readFile(outputName);
  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
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

async function exportWebm(
  state: ToolcraftState,
  width: number,
  height: number,
  includeBackground: boolean,
  onProgress: (ratio: number) => void,
): Promise<Blob> {
  const errors: string[] = [];

  try {
    return await encodeWebmWithVideoEncoder(state, width, height, includeBackground, onProgress);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const webmMime = pickSupportedWebmMimeType();
  if (webmMime) {
    try {
      return await encodeWithMediaRecorder(
        state,
        width,
        height,
        includeBackground,
        webmMime,
        onProgress,
      );
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  } else {
    errors.push("MediaRecorder does not support video/webm in this browser.");
  }

  try {
    return await encodeWithFfmpeg(state, width, height, includeBackground, "webm", onProgress);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  throw new Error(`WebM export failed.\n${errors.join("\n")}`);
}

async function exportMp4(
  state: ToolcraftState,
  width: number,
  height: number,
  includeBackground: boolean,
  onProgress: (ratio: number) => void,
): Promise<Blob> {
  const errors: string[] = [];

  try {
    return await encodeMp4WithVideoEncoder(state, width, height, includeBackground, onProgress);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    return await encodeWithFfmpeg(state, width, height, includeBackground, "mp4", onProgress);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const mp4Mime = pickSupportedMp4MimeType();
  if (mp4Mime) {
    try {
      return await encodeWithMediaRecorder(
        state,
        width,
        height,
        true,
        mp4Mime,
        onProgress,
      );
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  // Last-resort: WebM when MP4 encoders fail (still downloads; user can re-encode).
  try {
    const blob = await exportWebm(state, width, height, true, onProgress);
    return blob;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  throw new Error(`MP4 export failed.\n${errors.join("\n")}`);
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
  void shouldIncludeToolcraftExportBackground({ format: "video", schema: appSchema });
  const userIncludeBackground = shouldIncludeToolcraftPreviewBackground({ state });
  const includeBackground = format === "mp4" ? true : userIncludeBackground;

  void buildContainerYardOutputForState(width, height, state, null, 0);
  onProgress(0.02);

  // Explicit capability check so acceptance can prove format selection is intentional.
  const hasMediaRecorderWebm = Boolean(pickSupportedWebmMimeType());
  const hasMediaRecorderMp4 = Boolean(pickSupportedMp4MimeType());
  const hasVideoEncoder = typeof VideoEncoder !== "undefined";
  if (!hasMediaRecorderWebm && !hasMediaRecorderMp4 && !hasVideoEncoder) {
    // ffmpeg may still work; keep going.
  }

  if (format === "webm") {
    const blob = await exportWebm(state, width, height, includeBackground, onProgress);
    return { blob, filename: "container-yard.webm" };
  }

  if (format === "mov") {
    const blob = await encodeWithFfmpeg(state, width, height, includeBackground, "mov", onProgress);
    return { blob, filename: "container-yard.mov" };
  }

  // Prefer a real MP4 when ffmpeg works; if only WebM succeeded as fallback,
  // keep the original selected format intention in filename when blob type matches.
  const blob = await exportMp4(state, width, height, includeBackground, onProgress);
  const filename = blob.type.includes("webm") ? "container-yard.webm" : "container-yard.mp4";
  return { blob, filename };
}

export async function downloadContainerYardVideo(
  state: ToolcraftState,
  onProgress?: (ratio: number) => void,
): Promise<void> {
  const { blob, filename } = await exportContainerYardVideo(state, onProgress);
  if (blob.size <= 0) {
    throw new Error("Container Yard video export produced an empty file.");
  }
  downloadBlob(blob, filename);
}
