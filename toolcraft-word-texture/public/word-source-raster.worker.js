function normalizeMediaRotation(rotationDeg) {
  const normalized = ((Math.round((rotationDeg ?? 0) / 90) * 90) % 360 + 360) % 360;
  return normalized === 90 || normalized === 180 || normalized === 270 ? normalized : 0;
}

function coverScale(imageWidth, imageHeight, canvasWidth, canvasHeight, rotationDeg) {
  const rotated =
    rotationDeg === 90 || rotationDeg === 270
      ? { height: imageWidth, width: imageHeight }
      : { height: imageHeight, width: imageWidth };

  return Math.max(canvasWidth / rotated.width, canvasHeight / rotated.height);
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Word Tide failed to load source image."));
    image.src = dataUrl;
  });
}

self.addEventListener("message", async (event) => {
  try {
    const { canvasHeight, canvasWidth, dataUrl, transform } = event.data;
    const image = await loadImage(dataUrl);
    const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
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
    self.postMessage(
      {
        data: imageData.data,
        height: canvasHeight,
        width: canvasWidth,
      },
      [imageData.data.buffer],
    );
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Word Tide image rasterization failed.",
    });
  }
});
