import type { ToolcraftCanvasSize } from "../schema/types";

export type ToolcraftImportedImageFile = {
  dataUrl: string;
  size: ToolcraftCanvasSize;
};

export type ToolcraftImportedFile = {
  dataUrl: string;
};

export type ToolcraftImportedVideoFile = {
  dataUrl: string;
  durationSeconds: number;
  size: ToolcraftCanvasSize;
};

function readFileDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      resolve(typeof reader.result === "string" ? reader.result : null);
    });
    reader.addEventListener("error", () => resolve(null));
    reader.readAsDataURL(file);
  });
}

function readImageDataUrlSize(dataUrl: string): Promise<ToolcraftCanvasSize | null> {
  if (typeof Image === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const image = new Image();
    let resolved = false;
    let fallbackTimeout: number | undefined;
    const jsdomFallback =
      typeof navigator !== "undefined" &&
      navigator.userAgent.toLowerCase().includes("jsdom");
    const finish = (size: ToolcraftCanvasSize | null): void => {
      if (resolved) {
        return;
      }

      resolved = true;
      if (fallbackTimeout !== undefined) {
        window.clearTimeout(fallbackTimeout);
      }
      resolve(size);
    };

    fallbackTimeout = window.setTimeout(
      () => finish(null),
      jsdomFallback ? 0 : 5000,
    );

    image.addEventListener("load", () => {
      const width = Math.round(image.naturalWidth || image.width);
      const height = Math.round(image.naturalHeight || image.height);

      finish(
        width > 0 && height > 0
          ? {
              height,
              unit: "px",
              width,
            }
          : null,
      );
    });
    image.addEventListener("error", () => finish(null));
    image.src = dataUrl;
  });
}

export function isToolcraftImageFile(file: File): boolean {
  return (
    file.type.startsWith("image/") ||
    /\.(avif|gif|heic|heif|jpe?g|png|svg|tiff?|webp)$/i.test(file.name)
  );
}

export function isToolcraftVideoFile(file: File): boolean {
  return (
    file.type.startsWith("video/") ||
    /\.(mp4|mov|webm|m4v|ogv|mkv)$/i.test(file.name)
  );
}

export function isToolcraftSourceMediaFile(file: File): boolean {
  return isToolcraftImageFile(file) || isToolcraftVideoFile(file);
}

export function isToolcraftVideoAsset(asset: {
  dataUrl?: string;
  mimeType?: string;
  fileName?: string;
}): boolean {
  if (typeof asset.mimeType === "string" && asset.mimeType.startsWith("video/")) {
    return true;
  }

  if (typeof asset.fileName === "string" && /\.(mp4|mov|webm|m4v|ogv|mkv)$/i.test(asset.fileName)) {
    return true;
  }

  return typeof asset.dataUrl === "string" && asset.dataUrl.startsWith("blob:");
}

export async function readImportedFile(
  file: File,
): Promise<ToolcraftImportedFile | null> {
  const dataUrl = await readFileDataUrl(file);

  return dataUrl ? { dataUrl } : null;
}

export async function readImportedImageFile(
  file: File,
  fallbackSize: ToolcraftCanvasSize,
): Promise<ToolcraftImportedImageFile | null> {
  const dataUrl = await readFileDataUrl(file);

  if (!dataUrl) {
    return null;
  }

  return {
    dataUrl,
    size: (await readImageDataUrlSize(dataUrl)) ?? fallbackSize,
  };
}

export async function readImportedVideoFile(
  file: File,
  fallbackSize: ToolcraftCanvasSize,
): Promise<ToolcraftImportedVideoFile | null> {
  if (typeof URL === "undefined" || typeof document === "undefined") {
    return null;
  }

  const objectUrl = URL.createObjectURL(file);

  return new Promise((resolve) => {
    const video = document.createElement("video");
    let settled = false;

    const finish = (result: ToolcraftImportedVideoFile | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      video.removeAttribute("src");
      video.load();
      resolve(result);
    };

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    video.addEventListener("loadedmetadata", () => {
      const width = Math.round(video.videoWidth);
      const height = Math.round(video.videoHeight);
      const durationSeconds =
        Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 4;

      finish({
        dataUrl: objectUrl,
        durationSeconds,
        size:
          width > 0 && height > 0
            ? { height, unit: "px", width }
            : fallbackSize,
      });
    });

    video.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      finish(null);
    });

    video.src = objectUrl;
  });
}
