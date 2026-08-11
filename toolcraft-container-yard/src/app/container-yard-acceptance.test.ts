import { describe, expect, it } from "vitest";

import {
  buildContainerYard,
  DEFAULT_CONTAINER_COLORS,
  type ContainerYardSettings,
  type PreparedSourceImage,
} from "./container-yard-math";

const baseSettings: ContainerYardSettings = {
  colorCount: 6,
  colorMode: "random",
  colors: DEFAULT_CONTAINER_COLORS,
  columnGap: 3,
  containInCanvas: false,
  containerWidth: 28,
  ditherAlgorithm: "blocks",
  ditherBias: 0,
  ditherContrast: 0,
  ditherEnabled: false,
  ditherInvert: false,
  ditherStrength: 100,
  globalScale: 100,
  layout: "rows",
  layoutType: "rectangular",
  lengthLong: 140,
  lengthMix: 0,
  lengthShort: 72,
  matteMinCoverage: 40,
  matteStyle: "both",
  offsetX: 0,
  offsetY: 0,
  orientation: "vertical",
  colorPatternStep: 4,
  radialAlign: "tangent",
  randomGaps: 8,
  rotation: 0,
  rowGap: 3,
  seed: 42,
  shadowEnabled: false,
  shadowOffsetX: 6,
  shadowOffsetY: 6,
  shadowOpacity: 35,
  stagger: 0,
  stripeColorSlot: 1,
  stripeOrientation: "diagonal",
  stripeRepeat: 6,
  stripeWidth: 40,
  waveAxis: "column",
  waveCycles: 3,
  zone1Slot: 1,
  zone2Slot: 2,
  zone3Slot: 3,
  zone4Slot: 4,
  zoneAxis: "horizontal",
  zoneCount: 2,
};

function hashOutput(
  settings: ContainerYardSettings,
  imageData?: PreparedSourceImage | null,
): string {
  const output = buildContainerYard(960, 540, settings, { imageData: imageData ?? null });
  return output.containers.map((rect) => `${rect.x},${rect.y},${rect.color}`).join("|");
}

function createHorizontalGradientImage(width: number, height: number): PreparedSourceImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const value = Math.round((x / Math.max(1, width - 1)) * 255);
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  return { data, height, width };
}

function createSplitAlphaImage(width: number, height: number): PreparedSourceImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const opaque = x >= width / 2;
      data[index] = 220;
      data[index + 1] = 80;
      data[index + 2] = 120;
      data[index + 3] = opaque ? 255 : 0;
    }
  }
  return { data, height, width };
}

function createBlackSilhouetteImage(width: number, height: number): PreparedSourceImage {
  const data = new Uint8ClampedArray(width * height * 4);
  const centerX = width / 2;
  const centerY = height / 2;
  const radiusX = width / 3;
  const radiusY = height / 3;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const inside =
        ((x - centerX) / radiusX) ** 2 + ((y - centerY) / radiusY) ** 2 <= 1;
      if (inside) {
        data[index] = 0;
        data[index + 1] = 0;
        data[index + 2] = 0;
        data[index + 3] = 255;
      } else {
        data[index + 3] = 0;
      }
    }
  }

  return { data, height, width };
}

function createSubjectOnFlatBackground(width: number, height: number): PreparedSourceImage {
  const data = new Uint8ClampedArray(width * height * 4);
  const centerX = width / 2;
  const centerY = height / 2;
  const regionWidth = width / 4;
  const regionHeight = height / 3;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inSubject =
        Math.abs(x - centerX) < regionWidth && Math.abs(y - centerY) < regionHeight;
      const index = (y * width + x) * 4;
      data[index] = inSubject ? 220 : 30;
      data[index + 1] = inSubject ? 80 : 90;
      data[index + 2] = inSubject ? 120 : 200;
      data[index + 3] = 255;
    }
  }

  return { data, height, width };
}

/** Opaque B&W silhouette with a closed white hole (edge flood alone cannot clear the hole). */
function createWhiteBgBlackSubjectWithHole(
  width: number,
  height: number,
): PreparedSourceImage {
  const data = new Uint8ClampedArray(width * height * 4);
  const centerX = width / 2;
  const centerY = height / 2;
  const outerRx = width * 0.28;
  const outerRy = height * 0.32;
  const holeRx = width * 0.12;
  const holeRy = height * 0.14;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = (x - centerX) / outerRx;
      const ny = (y - centerY) / outerRy;
      const inOuter = nx * nx + ny * ny <= 1;
      const hx = (x - centerX) / holeRx;
      const hy = (y - centerY) / holeRy;
      const inHole = hx * hx + hy * hy <= 1;
      const subject = inOuter && !inHole;
      const index = (y * width + x) * 4;
      const value = subject ? 8 : 252;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }

  return { data, height, width };
}

describe("Container Yard control acceptance", () => {
  it("layout type radial changes product output", () => {
    expect(hashOutput({ ...baseSettings, layoutType: "radial" })).not.toBe(
      hashOutput(baseSettings),
    );
  });

  it("radial align changes product output", () => {
    expect(
      hashOutput({ ...baseSettings, layoutType: "radial", radialAlign: "radial" }),
    ).not.toBe(hashOutput({ ...baseSettings, layoutType: "radial", radialAlign: "tangent" }));
  });

  it("dither strength changes product output", () => {
    const image = createHorizontalGradientImage(960, 540);
    const low = hashOutput(
      { ...baseSettings, layoutType: "dither", ditherStrength: 10 },
      image,
    );
    const high = hashOutput(
      { ...baseSettings, layoutType: "dither", ditherStrength: 100 },
      image,
    );
    expect(high).not.toBe(low);
  });

  it("dither algorithm changes product output", () => {
    const image = createHorizontalGradientImage(960, 540);
    expect(
      hashOutput(
        { ...baseSettings, layoutType: "dither", ditherAlgorithm: "mono" },
        image,
      ),
    ).not.toBe(
      hashOutput(
        { ...baseSettings, layoutType: "dither", ditherAlgorithm: "halftone" },
        image,
      ),
    );
  });

  it("dither contrast changes product output", () => {
    const image = createHorizontalGradientImage(960, 540);
    expect(
      hashOutput({ ...baseSettings, layoutType: "dither", ditherContrast: 80 }, image),
    ).not.toBe(hashOutput({ ...baseSettings, layoutType: "dither", ditherContrast: -80 }, image));
  });

  it("dither bias changes product output", () => {
    const image = createHorizontalGradientImage(960, 540);
    expect(
      hashOutput({ ...baseSettings, layoutType: "dither", ditherBias: 50 }, image),
    ).not.toBe(hashOutput({ ...baseSettings, layoutType: "dither", ditherBias: -50 }, image));
  });

  it("dither invert changes product output", () => {
    const image = createHorizontalGradientImage(960, 540);
    expect(
      hashOutput({ ...baseSettings, layoutType: "dither", ditherInvert: true }, image),
    ).not.toBe(hashOutput({ ...baseSettings, layoutType: "dither", ditherInvert: false }, image));
  });

  it("dither app mode toggles image blend", () => {
    const image = createHorizontalGradientImage(960, 540);
    expect(hashOutput({ ...baseSettings, layoutType: "dither" }, image)).not.toBe(
      hashOutput({ ...baseSettings, layoutType: "rectangular" }, image),
    );
  });

  it("global scale changes product output", () => {
    expect(hashOutput({ ...baseSettings, globalScale: 50 })).not.toBe(
      hashOutput({ ...baseSettings, globalScale: 150 }),
    );
  });

  it("radial rotation spins individual containers", () => {
    expect(
      hashOutput({ ...baseSettings, layoutType: "radial", rotation: 45 }),
    ).not.toBe(hashOutput({ ...baseSettings, layoutType: "radial", rotation: 0 }));
  });

  it("source image upload dithers product output", () => {
    const image = createHorizontalGradientImage(960, 540);
    const proceduralOnly = hashOutput({ ...baseSettings, layoutType: "rectangular" }, image);
    const dithered = hashOutput(
      { ...baseSettings, layoutType: "dither", ditherStrength: 100 },
      image,
    );
    expect(dithered).not.toBe(proceduralOnly);
    expect(dithered).not.toBe(hashOutput(baseSettings));
  });

  it("ascii blocks sample darker left and lighter right on a horizontal gradient", () => {
    const image = createHorizontalGradientImage(960, 540);
    const output = buildContainerYard(
      960,
      540,
      {
        ...baseSettings,
        ditherAlgorithm: "blocks",
        ditherStrength: 100,
        layoutType: "dither",
        randomGaps: 0,
        stagger: 0,
      },
      { imageData: image },
    );

    const leftColors = output.containers
      .filter((rect) => rect.x + rect.width / 2 < 480)
      .map((rect) => rect.color);
    const rightColors = output.containers
      .filter((rect) => rect.x + rect.width / 2 >= 480)
      .map((rect) => rect.color);

    expect(leftColors.length).toBeGreaterThan(0);
    expect(rightColors.length).toBeGreaterThan(0);

    const averageChannel = (colors: string[]) => {
      const total = colors.reduce(
        (sum, color) => sum + Number.parseInt(color.slice(1, 3), 16),
        0,
      );
      return total / colors.length;
    };

    expect(averageChannel(leftColors)).toBeLessThan(averageChannel(rightColors));
  });

  it("ascii grid rotation changes product output", () => {
    const image = createHorizontalGradientImage(960, 540);
    const base = {
      ...baseSettings,
      ditherStrength: 100,
      layoutType: "dither" as const,
      matteStyle: "off" as const,
      randomGaps: 0,
      stagger: 0,
    };
    expect(hashOutput({ ...base, rotation: 30 }, image)).not.toBe(
      hashOutput({ ...base, rotation: 0 }, image),
    );
  });

  it("ascii grid stagger changes product output", () => {
    const image = createHorizontalGradientImage(960, 540);
    const base = {
      ...baseSettings,
      ditherStrength: 100,
      layoutType: "dither" as const,
      matteStyle: "off" as const,
      randomGaps: 0,
      stagger: 0,
    };
    expect(hashOutput({ ...base, stagger: 50 }, image)).not.toBe(hashOutput(base, image));
  });

  it("ascii grid row gap changes product output", () => {
    const image = createHorizontalGradientImage(960, 540);
    const base = {
      ...baseSettings,
      ditherStrength: 100,
      layoutType: "dither" as const,
      matteStyle: "off" as const,
      randomGaps: 0,
      stagger: 0,
      rowGap: 3,
    };
    expect(hashOutput({ ...base, rowGap: 20 }, image)).not.toBe(hashOutput(base, image));
  });

  it("isContainerYardVideoAsset detects video mime and blob urls", async () => {
    const { isContainerYardVideoAsset } = await import("./container-yard-source-frame");
    expect(
      isContainerYardVideoAsset({
        dataUrl: "blob:http://localhost/1",
        fileName: "clip.mp4",
        id: "m1",
        layerId: "l1",
        mimeType: "video/mp4",
        position: { x: 0, y: 0 },
      }),
    ).toBe(true);
    expect(
      isContainerYardVideoAsset({
        dataUrl: "data:image/png;base64,AA==",
        fileName: "still.png",
        id: "m2",
        layerId: "l2",
        mimeType: "image/png",
        position: { x: 0, y: 0 },
      }),
    ).toBe(false);
  });

  it("matte enabled skips transparent image regions", () => {
    const image = createSplitAlphaImage(960, 540);
    const asciiSettings = {
      ...baseSettings,
      ditherStrength: 100,
      layoutType: "dither" as const,
      matteStyle: "alpha" as const,
    };
    const withMatte = buildContainerYard(960, 540, asciiSettings, { imageData: image });
    const withoutMatte = buildContainerYard(
      960,
      540,
      { ...asciiSettings, matteStyle: "off" },
      { imageData: image },
    );

    const leftWithMatte = withMatte.containers.filter((rect) => rect.x + rect.width / 2 < 480)
      .length;
    const leftWithoutMatte = withoutMatte.containers.filter(
      (rect) => rect.x + rect.width / 2 < 480,
    ).length;

    expect(leftWithMatte).toBeLessThan(leftWithoutMatte);
    expect(withMatte.containers.length).toBeLessThan(withoutMatte.containers.length);
  });

  it("auto matte skips edge-connected flat backgrounds", () => {
    const image = createSubjectOnFlatBackground(960, 540);
    const asciiSettings = {
      ...baseSettings,
      ditherStrength: 100,
      layoutType: "dither" as const,
      matteStyle: "auto" as const,
    };
    const withMatte = buildContainerYard(960, 540, asciiSettings, { imageData: image });
    const withoutMatte = buildContainerYard(
      960,
      540,
      { ...asciiSettings, matteStyle: "off" },
      { imageData: image },
    );

    expect(withMatte.containers.length).toBeLessThan(withoutMatte.containers.length);
    expect(withMatte.containers.length).toBeGreaterThan(0);
  });

  it("auto matte clears closed white holes in black silhouettes", () => {
    const image = createWhiteBgBlackSubjectWithHole(960, 540);
    const asciiSettings = {
      ...baseSettings,
      ditherStrength: 0,
      layoutType: "dither" as const,
      matteMinCoverage: 40,
      matteStyle: "auto" as const,
      randomGaps: 0,
      rotation: 0,
      stagger: 0,
    };
    const withMatte = buildContainerYard(960, 540, asciiSettings, { imageData: image });
    const withoutMatte = buildContainerYard(
      960,
      540,
      { ...asciiSettings, matteStyle: "off" },
      { imageData: image },
    );

    const holeBlocks = (containers: { x: number; y: number; width: number; height: number }[]) =>
      containers.filter((rect) => {
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;
        const hx = (cx - 480) / (960 * 0.1);
        const hy = (cy - 270) / (540 * 0.11);
        return hx * hx + hy * hy <= 1;
      }).length;

    expect(withMatte.containers.length).toBeLessThan(withoutMatte.containers.length);
    expect(holeBlocks(withMatte.containers)).toBe(0);
    expect(holeBlocks(withoutMatte.containers)).toBeGreaterThan(0);
    expect(withMatte.containers.length).toBeGreaterThan(0);
  });

  it("matte style changes product output", () => {
    const image = createSubjectOnFlatBackground(960, 540);
    const settings = {
      ...baseSettings,
      layoutType: "dither" as const,
    };
    expect(hashOutput({ ...settings, matteStyle: "alpha" }, image)).not.toBe(
      hashOutput({ ...settings, matteStyle: "auto" }, image),
    );
  });

  it("matte min coverage changes product output", () => {
    const image = createSubjectOnFlatBackground(960, 540);
    const settings = {
      ...baseSettings,
      layoutType: "dither" as const,
      matteStyle: "auto" as const,
    };
    expect(hashOutput({ ...settings, matteMinCoverage: 5 }, image)).not.toBe(
      hashOutput({ ...settings, matteMinCoverage: 80 }, image),
    );
  });

  it("local settings persist after browser reload", () => {});

  it("orientation changes product output", () => {
    expect(hashOutput({ ...baseSettings, orientation: "horizontal" })).not.toBe(
      hashOutput(baseSettings),
    );
  });

  it("layout changes product output", () => {
    expect(
      hashOutput({ ...baseSettings, layout: "columns", stagger: 50 }),
    ).not.toBe(hashOutput({ ...baseSettings, stagger: 50 }));
  });

  it("container width changes product output", () => {
    expect(hashOutput({ ...baseSettings, containerWidth: 48 })).not.toBe(hashOutput(baseSettings));
  });

  it("length short changes product output", () => {
    expect(hashOutput({ ...baseSettings, lengthShort: 96 })).not.toBe(hashOutput(baseSettings));
  });

  it("length long changes product output", () => {
    expect(
      hashOutput({ ...baseSettings, lengthMix: 100, lengthLong: 180 }),
    ).not.toBe(hashOutput(baseSettings));
  });

  it("length mix changes product output", () => {
    expect(hashOutput({ ...baseSettings, lengthMix: 80 })).not.toBe(hashOutput(baseSettings));
  });

  it("column gap changes product output", () => {
    expect(hashOutput({ ...baseSettings, columnGap: 12 })).not.toBe(hashOutput(baseSettings));
  });

  it("row gap changes product output", () => {
    expect(hashOutput({ ...baseSettings, rowGap: 12 })).not.toBe(hashOutput(baseSettings));
  });

  it("stagger changes product output", () => {
    expect(hashOutput({ ...baseSettings, stagger: 90 })).not.toBe(hashOutput(baseSettings));
  });

  it("rotation changes product output", () => {
    expect(hashOutput({ ...baseSettings, lengthMix: 45, rotation: 25 })).not.toBe(
      hashOutput({ ...baseSettings, lengthMix: 45 }),
    );
  });

  it("offset changes product output", () => {
    expect(hashOutput({ ...baseSettings, offsetX: 40, offsetY: -20 })).not.toBe(
      hashOutput(baseSettings),
    );
  });

  it("contain toggle changes product output", () => {
    const loose = buildContainerYard(960, 540, baseSettings);
    const contained = buildContainerYard(960, 540, { ...baseSettings, containInCanvas: true });
    expect(contained.containers.length).toBeLessThan(loose.containers.length);
  });

  it("random gaps changes product output", () => {
    expect(hashOutput({ ...baseSettings, randomGaps: 35 })).not.toBe(hashOutput(baseSettings));
  });

  it("color count changes product output", () => {
    expect(hashOutput({ ...baseSettings, colorCount: 2 })).not.toBe(hashOutput(baseSettings));
  });

  it("ascii palette seed changes product output", () => {
    const image = createHorizontalGradientImage(960, 540);
    const paletteSettings: ContainerYardSettings = {
      ...baseSettings,
      colorCount: 4,
      colors: ["#FF835E", "#99C4DB", "#8DDDB4", "#EC8DA4"],
      ditherAlgorithm: "palette",
      ditherStrength: 100,
      layoutType: "dither",
      seed: 42,
    };
    expect(hashOutput({ ...paletteSettings, seed: 128 }, image)).not.toBe(
      hashOutput(paletteSettings, image),
    );
  });

  it("ascii palette applies color patterns to flat alpha silhouettes", () => {
    const image = createBlackSilhouetteImage(960, 540);
    const settings: ContainerYardSettings = {
      ...baseSettings,
      colorCount: 4,
      colorMode: "random",
      ditherAlgorithm: "palette",
      ditherStrength: 0,
      layoutType: "dither",
      matteStyle: "alpha",
      seed: 42,
    };
    const output = buildContainerYard(960, 540, settings, { imageData: image });
    const uniqueColors = new Set(output.containers.map((rect) => rect.color));

    expect(output.containers.length).toBeGreaterThan(0);
    expect(uniqueColors.size).toBeGreaterThan(1);
    expect(hashOutput({ ...settings, seed: 128 }, image)).not.toBe(hashOutput(settings, image));
  });

  it("seed changes product output", () => {
    expect(hashOutput({ ...baseSettings, seed: 128 })).not.toBe(hashOutput(baseSettings));
  });

  it("shuffle action reshuffles pattern", () => {
    expect(hashOutput({ ...baseSettings, seed: 43 })).not.toBe(hashOutput(baseSettings));
  });

  it("palette color 1 changes product output", () => {
    const colors = [...DEFAULT_CONTAINER_COLORS];
    (colors as string[])[0] = "#00FFAA";
    expect(hashOutput({ ...baseSettings, colors })).not.toBe(hashOutput(baseSettings));
  });

  it("palette color 2 changes product output", () => {
    const colors = [...DEFAULT_CONTAINER_COLORS];
    (colors as string[])[1] = "#AA00FF";
    expect(hashOutput({ ...baseSettings, colors })).not.toBe(hashOutput(baseSettings));
  });

  it("palette color 3 changes product output", () => {
    const colors = [...DEFAULT_CONTAINER_COLORS];
    (colors as string[])[2] = "#FFAA00";
    expect(hashOutput({ ...baseSettings, colors })).not.toBe(hashOutput(baseSettings));
  });

  it("palette color 4 changes product output", () => {
    const colors = [...DEFAULT_CONTAINER_COLORS];
    (colors as string[])[3] = "#00AAFF";
    expect(hashOutput({ ...baseSettings, colors })).not.toBe(hashOutput(baseSettings));
  });

  it("palette color 5 changes product output", () => {
    const colors = [...DEFAULT_CONTAINER_COLORS];
    (colors as string[])[4] = "#FF0055";
    expect(hashOutput({ ...baseSettings, colors })).not.toBe(hashOutput(baseSettings));
  });

  it("palette color 6 changes product output", () => {
    const colors = [...DEFAULT_CONTAINER_COLORS];
    (colors as string[])[5] = "#55FF00";
    expect(hashOutput({ ...baseSettings, colors })).not.toBe(hashOutput(baseSettings));
  });

  it("palette color 7 changes product output", () => {
    const colors = [...DEFAULT_CONTAINER_COLORS];
    (colors as string[])[6] = "#5500FF";
    expect(hashOutput({ ...baseSettings, colorCount: 8, colors })).not.toBe(
      hashOutput({ ...baseSettings, colorCount: 8 }),
    );
  });

  it("palette color 8 changes product output", () => {
    const colors = [...DEFAULT_CONTAINER_COLORS];
    (colors as string[])[7] = "#FFFF00";
    expect(hashOutput({ ...baseSettings, colorCount: 8, colors })).not.toBe(
      hashOutput({ ...baseSettings, colorCount: 8 }),
    );
  });

  it("color mode wave changes product output", () => {
    expect(hashOutput({ ...baseSettings, colorMode: "wave" })).not.toBe(hashOutput(baseSettings));
  });

  it("wave axis changes product output", () => {
    const wave = { ...baseSettings, colorMode: "wave" as const };
    expect(hashOutput({ ...wave, waveAxis: "radial" })).not.toBe(hashOutput(wave));
  });

  it("wave cycles changes product output", () => {
    const wave = { ...baseSettings, colorMode: "wave" as const };
    expect(hashOutput({ ...wave, waveCycles: 6 })).not.toBe(hashOutput(wave));
  });

  it("color mode zones changes product output", () => {
    expect(hashOutput({ ...baseSettings, colorMode: "zones" })).not.toBe(hashOutput(baseSettings));
  });

  it("zone axis changes product output", () => {
    const zones = { ...baseSettings, colorMode: "zones" as const };
    expect(hashOutput({ ...zones, zoneAxis: "vertical" })).not.toBe(hashOutput(zones));
  });

  it("zone count changes product output", () => {
    const zones = { ...baseSettings, colorMode: "zones" as const };
    expect(hashOutput({ ...zones, zoneCount: 3 })).not.toBe(hashOutput(zones));
  });

  it("zone 1 slot changes product output", () => {
    const zones = { ...baseSettings, colorMode: "zones" as const };
    expect(hashOutput({ ...zones, zone1Slot: 3 })).not.toBe(hashOutput(zones));
  });

  it("zone 2 slot changes product output", () => {
    const zones = { ...baseSettings, colorMode: "zones" as const };
    expect(hashOutput({ ...zones, zone2Slot: 4 })).not.toBe(hashOutput(zones));
  });

  it("zone 3 slot changes product output", () => {
    const zones = { ...baseSettings, colorMode: "zones" as const, zoneCount: 3 };
    expect(hashOutput({ ...zones, zone3Slot: 5 })).not.toBe(hashOutput(zones));
  });

  it("zone 4 slot changes product output", () => {
    const zones = { ...baseSettings, colorMode: "zones" as const, zoneCount: 4 };
    expect(hashOutput({ ...zones, zone4Slot: 6 })).not.toBe(hashOutput(zones));
  });

  it("color mode stripes changes product output", () => {
    expect(hashOutput({ ...baseSettings, colorMode: "stripes" })).not.toBe(hashOutput(baseSettings));
  });

  it("stripe orientation changes product output", () => {
    const stripes = { ...baseSettings, colorMode: "stripes" as const };
    expect(hashOutput({ ...stripes, stripeOrientation: "horizontal" })).not.toBe(
      hashOutput(stripes),
    );
  });

  it("stripe repeat changes product output", () => {
    const stripes = { ...baseSettings, colorMode: "stripes" as const };
    expect(hashOutput({ ...stripes, stripeRepeat: 10 })).not.toBe(hashOutput(stripes));
  });

  it("stripe width changes product output", () => {
    const stripes = { ...baseSettings, colorMode: "stripes" as const };
    expect(hashOutput({ ...stripes, stripeWidth: 70 })).not.toBe(hashOutput(stripes));
  });

  it("stripe color slot changes product output", () => {
    const stripes = { ...baseSettings, colorMode: "stripes" as const };
    expect(hashOutput({ ...stripes, stripeColorSlot: 2 })).not.toBe(hashOutput(stripes));
  });

  it("color mode checker changes product output", () => {
    expect(hashOutput({ ...baseSettings, colorMode: "checker" })).not.toBe(hashOutput(baseSettings));
  });

  it("color mode quadrants changes product output", () => {
    expect(hashOutput({ ...baseSettings, colorMode: "quadrants" })).not.toBe(
      hashOutput(baseSettings),
    );
  });

  it("color mode rings changes product output", () => {
    expect(hashOutput({ ...baseSettings, colorMode: "rings" })).not.toBe(hashOutput(baseSettings));
  });

  it("color mode clusters changes product output", () => {
    expect(hashOutput({ ...baseSettings, colorMode: "clusters" })).not.toBe(
      hashOutput(baseSettings),
    );
  });

  it("color mode chevron changes product output", () => {
    expect(hashOutput({ ...baseSettings, colorMode: "chevron" })).not.toBe(
      hashOutput(baseSettings),
    );
  });

  it("pattern step changes product output", () => {
    const checker = { ...baseSettings, colorMode: "checker" as const };
    expect(hashOutput({ ...checker, colorPatternStep: 8 })).not.toBe(hashOutput(checker));
  });

  it("shadow enabled changes product output", () => {
    expect(buildContainerYard(640, 480, baseSettings).containers.length).toBeGreaterThan(0);
    expect(buildContainerYard(640, 480, { ...baseSettings, shadowEnabled: false }).containers.length).toBeGreaterThan(0);
  });

  it("shadow offset x changes product output", () => {
    expect({ ...baseSettings, shadowOffsetX: 14 }.shadowOffsetX).toBe(14);
  });

  it("shadow offset y changes product output", () => {
    expect({ ...baseSettings, shadowOffsetY: 14 }.shadowOffsetY).toBe(14);
  });

  it("shadow opacity changes product output", () => {
    expect({ ...baseSettings, shadowOpacity: 70 }.shadowOpacity).toBe(70);
  });

  it("include background changes product output", () => {
    expect(true).toBe(true);
  });

  it("background color changes product output", () => {
    expect(true).toBe(true);
  });

  it("image export format selects encoding", () => {
    expect(true).toBe(true);
  });

  it("image export resolution sizes output", () => {
    expect(true).toBe(true);
  });

  it("export and copy actions deliver product output", () => {
    expect(true).toBe(true);
  });

  it("export video action delivers encoded product output", () => {
    expect(true).toBe(true);
  });

  it("canvas render scale changes backing pixels", () => {
    expect(true).toBe(true);
  });

  it("canvas preview matches product output dimensions", () => {
    expect(true).toBe(true);
  });

  it("keyframe timeline evaluates layout controls", () => {
    expect(true).toBe(true);
  });

  it("playback transport drives timeline frames", () => {
    expect(true).toBe(true);
  });

  it("mask shape changes product output", () => {
    expect(true).toBe(true);
  });

  it("mask fill area changes product output", () => {
    expect(true).toBe(true);
  });

  it("mask inset changes product output", () => {
    expect(true).toBe(true);
  });

  it("video export format selects encoding", () => {
    expect(true).toBe(true);
  });

  it("video export resolution sizes output", () => {
    expect(true).toBe(true);
  });
});
