/**
 * Rasterize still or video source media into canvas-sized PreparedSourceImage.
 */

import type { ToolcraftMediaAsset, ToolcraftMediaTransform } from "@/toolcraft/runtime";
import { isToolcraftVideoAsset } from "@/toolcraft/runtime/react/media-file";

import type { PreparedSourceImage } from "./container-yard-image-sample";
import { prepareSourceImageFromAsset, readCanvasImageData } from "./container-yard-image-raster";

function normalizeMediaRotation(rotationDeg: number | undefined): 0 | 90 | 180 | 270 {
  const normalized = ((Math.round((rotationDeg ?? 0) / 90) * 90) % 360 + 360) % 360;
  return normalized === 90 || normalized === 180 || normalized === 270 ? normalized : 0;
}

function coverScale(
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  rotationDeg: 0 | 90 | 180 | 270,
): number {
  const rotated =
    rotationDeg === 90 || rotationDeg === 270
      ? { height: imageWidth, width: imageHeight }
      : { height: imageHeight, width: imageWidth };

  return Math.max(canvasWidth / rotated.width, canvasHeight / rotated.height);
}

const videoElementCache = new Map<string, HTMLVideoElement>();

export function isContainerYardVideoAsset(asset: ToolcraftMediaAsset | undefined | null): boolean {
  return Boolean(asset && isToolcraftVideoAsset(asset));
}

export function getOrCreateSourceVideoElement(asset: ToolcraftMediaAsset): HTMLVideoElement {
  const cached = videoElementCache.get(asset.id);
  if (cached && cached.src === asset.dataUrl) {
    return cached;
  }

  if (cached) {
    cached.pause();
    cached.removeAttribute("src");
    cached.load();
    videoElementCache.delete(asset.id);
  }

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.src = asset.dataUrl;
  videoElementCache.set(asset.id, video);
  return video;
}

export function revokeCachedSourceVideo(assetId: string): void {
  const video = videoElementCache.get(assetId);
  if (!video) {
    return;
  }
  video.pause();
  video.removeAttribute("src");
  video.load();
  videoElementCache.delete(assetId);
}

const VIDEO_READY_TIMEOUT_MS = 4000;

function waitForVideoEvent(
  video: HTMLVideoElement,
  eventName: "seeked" | "loadedmetadata" | "loadeddata",
  timeoutMessage: string,
  timeoutMs = VIDEO_READY_TIMEOUT_MS,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      cleanup();
      if (video.readyState >= 2) {
        resolve();
        return;
      }
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(timeoutMessage));
    };
    const cleanup = () => {
      globalThis.clearTimeout(timer);
      video.removeEventListener(eventName, onReady);
      video.removeEventListener("error", onError);
    };

    video.addEventListener(eventName, onReady);
    video.addEventListener("error", onError);
  });
}

export async function waitForVideoSeek(
  video: HTMLVideoElement,
  timeSeconds: number,
  timeoutMs = VIDEO_READY_TIMEOUT_MS,
): Promise<void> {
  const clamped = Math.max(
    0,
    Math.min(
      Number.isFinite(video.duration) ? video.duration : timeSeconds,
      timeSeconds,
    ),
  );

  if (Math.abs(video.currentTime - clamped) < 0.001) {
    if (video.readyState >= 2) {
      return;
    }
    await waitForVideoEvent(
      video,
      "loadeddata",
      "Timed out waiting for the source video frame.",
      timeoutMs,
    );
    return;
  }

  const seeked = waitForVideoEvent(
    video,
    "seeked",
    "Timed out seeking the source video.",
    timeoutMs,
  );
  try {
    video.currentTime = clamped;
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
  await seeked;
}

export function rasterizeVideoElementFrame(
  video: HTMLVideoElement,
  canvasWidth: number,
  canvasHeight: number,
  transform?: ToolcraftMediaTransform,
): PreparedSourceImage {
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Container Yard video rasterization requires Canvas 2D.");
  }

  const sourceWidth = Math.max(1, video.videoWidth || canvasWidth);
  const sourceHeight = Math.max(1, video.videoHeight || canvasHeight);
  const rotationDeg = normalizeMediaRotation(transform?.rotationDeg);
  const flipH = transform?.flipHorizontal === true;
  const flipV = transform?.flipVertical === true;
  const scale = coverScale(sourceWidth, sourceHeight, canvasWidth, canvasHeight, rotationDeg);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;

  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.save();
  context.translate(canvasWidth / 2, canvasHeight / 2);
  context.rotate((rotationDeg * Math.PI) / 180);
  context.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  context.drawImage(video, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  context.restore();

  const imageData = readCanvasImageData(context, 0, 0, canvasWidth, canvasHeight);
  return {
    data: imageData.data,
    height: canvasHeight,
    width: canvasWidth,
  };
}

export async function rasterizeVideoFrameAtTime(
  asset: ToolcraftMediaAsset,
  timeSeconds: number,
  canvasWidth: number,
  canvasHeight: number,
): Promise<PreparedSourceImage> {
  const video = getOrCreateSourceVideoElement(asset);

  if (video.readyState < 1) {
    await waitForVideoEvent(
      video,
      "loadedmetadata",
      "Timed out loading the source video.",
    );
  }

  await waitForVideoSeek(video, timeSeconds);
  return rasterizeVideoElementFrame(video, canvasWidth, canvasHeight, asset.transform);
}

export async function prepareSourceFrameAtTime(
  asset: ToolcraftMediaAsset | undefined,
  timeSeconds: number,
  canvasWidth: number,
  canvasHeight: number,
): Promise<PreparedSourceImage | null> {
  if (!asset) {
    return null;
  }

  if (isContainerYardVideoAsset(asset)) {
    return rasterizeVideoFrameAtTime(asset, timeSeconds, canvasWidth, canvasHeight);
  }

  return prepareSourceImageFromAsset(asset, canvasWidth, canvasHeight);
}

export async function readVideoDurationSeconds(asset: ToolcraftMediaAsset): Promise<number | null> {
  if (!isContainerYardVideoAsset(asset)) {
    return null;
  }

  const video = getOrCreateSourceVideoElement(asset);
  if (Number.isFinite(video.duration) && video.duration > 0) {
    return video.duration;
  }

  await waitForVideoEvent(
    video,
    "loadedmetadata",
    "Timed out reading source video duration.",
  );

  return Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
}
