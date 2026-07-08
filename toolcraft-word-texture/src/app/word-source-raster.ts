/**
 * Load source image into canvas-sized ImageData with cover/crop and runtime transforms.
 */

import type { ToolcraftMediaAsset, ToolcraftMediaTransform } from "@/toolcraft/runtime";

import type { PreparedSourceImage } from "./word-source-sample";

type RasterWorkerResponse = {
  data?: Uint8ClampedArray;
  error?: string;
  height?: number;
  width?: number;
};

let rasterWorker: Worker | null = null;

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

function getRasterWorker(): Worker | null {
  if (typeof Worker === "undefined") {
    return null;
  }

  if (!rasterWorker) {
    try {
      rasterWorker = new Worker("/word-source-raster.worker.js");
    } catch {
      return null;
    }
  }

  return rasterWorker;
}

export async function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Word Tide failed to load source image."));
    image.src = dataUrl;
  });
}

export async function rasterizeSourceImageOnMainThread(
  dataUrl: string,
  canvasWidth: number,
  canvasHeight: number,
  transform?: ToolcraftMediaTransform,
): Promise<PreparedSourceImage> {
  const image = await loadImageElement(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Word Tide source rasterization requires Canvas 2D.");
  }

  const rotationDeg = normalizeMediaRotation(transform?.rotationDeg);
  const flipH = transform?.flipHorizontal === true;
  const flipV = transform?.flipVertical === true;

  context.save();
  context.translate(canvasWidth / 2, canvasHeight / 2);

  if (rotationDeg !== 0) {
    context.rotate((rotationDeg * Math.PI) / 180);
  }

  const scale = coverScale(image.width, image.height, canvasWidth, canvasHeight, rotationDeg);
  const scaleX = (flipH ? -1 : 1) * scale;
  const scaleY = (flipV ? -1 : 1) * scale;
  context.scale(scaleX, scaleY);
  context.drawImage(image, -image.width / 2, -image.height / 2);
  context.restore();

  const imageData = context.getImageData(0, 0, canvasWidth, canvasHeight);

  return {
    data: imageData.data,
    height: canvasHeight,
    width: canvasWidth,
  };
}

async function rasterizeSourceImageWithWorker(
  dataUrl: string,
  canvasWidth: number,
  canvasHeight: number,
  transform?: ToolcraftMediaTransform,
): Promise<PreparedSourceImage> {
  const worker = getRasterWorker();
  if (!worker) {
    throw new Error("Word Tide image raster worker is unavailable.");
  }

  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent<RasterWorkerResponse>) => {
      cleanup();

      if (event.data.error) {
        reject(new Error(event.data.error));
        return;
      }

      const { data, height, width } = event.data;
      if (!data || height === undefined || width === undefined) {
        reject(new Error("Word Tide image rasterization returned empty data."));
        return;
      }

      const pixels =
        data instanceof Uint8ClampedArray
          ? data
          : new Uint8ClampedArray(data as ArrayBuffer);

      resolve({
        data: pixels,
        height,
        width,
      });
    };

    const handleError = () => {
      cleanup();
      reject(new Error("Word Tide image raster worker failed."));
    };

    const cleanup = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage({
      canvasHeight,
      canvasWidth,
      dataUrl,
      transform,
    });
  });
}

export async function rasterizeSourceImageToCanvas(
  dataUrl: string,
  canvasWidth: number,
  canvasHeight: number,
  transform?: ToolcraftMediaTransform,
): Promise<PreparedSourceImage> {
  if (typeof document !== "undefined") {
    return rasterizeSourceImageOnMainThread(dataUrl, canvasWidth, canvasHeight, transform);
  }

  return rasterizeSourceImageWithWorker(dataUrl, canvasWidth, canvasHeight, transform);
}

export function getSourceImageAsset(
  mediaAssets: readonly ToolcraftMediaAsset[],
  sourceTarget = "media.sourceImage",
): ToolcraftMediaAsset | undefined {
  const targeted = mediaAssets.find(
    (asset) =>
      asset.sourceTarget === sourceTarget && (asset.assetKind ?? "image") === "image",
  );
  if (targeted) {
    return targeted;
  }

  const imageAssets = mediaAssets.filter(
    (asset) => (asset.assetKind ?? "image") === "image",
  );

  return imageAssets.length === 1 ? imageAssets[0] : undefined;
}

export function buildSourceImageCacheKey(
  asset: ToolcraftMediaAsset,
  canvasWidth: number,
  canvasHeight: number,
): string {
  const transform = asset.transform;
  return [
    asset.id,
    canvasWidth,
    canvasHeight,
    transform?.rotationDeg ?? 0,
    transform?.flipHorizontal ? 1 : 0,
    transform?.flipVertical ? 1 : 0,
  ].join(":");
}

export async function prepareSourceImageFromAsset(
  asset: ToolcraftMediaAsset,
  canvasWidth: number,
  canvasHeight: number,
): Promise<PreparedSourceImage> {
  return rasterizeSourceImageToCanvas(
    asset.dataUrl,
    canvasWidth,
    canvasHeight,
    asset.transform,
  );
}
