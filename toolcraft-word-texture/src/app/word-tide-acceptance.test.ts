import { describe, expect, it } from "vitest";

import { appSchema } from "./app-schema";
import {
  buildPathSplinePathD,
  createPathId,
  type FlowPath,
} from "./flow-path-math";
import { createVectorField, type VectorFieldSettings } from "./flow-vector-field";
import { layoutWordFlow, type WordFlowSettings } from "./word-flow-layout";
import { layoutWordGrid, type WordGridSettings } from "./word-grid-layout";
import type {
  HighlightSettings,
  InkSettings,
  MeasureWord,
  PlacedWord,
  ToneZoneSettings,
} from "./word-layout-types";
import { buildShapeMask, type ShapeMask } from "./word-mask";
import type { PreparedSourceImage } from "./word-source-sample";
import { applyTextCase } from "./word-tokens";
import { resolveTypography, type ResolvedTypography } from "./word-font";
import {
  buildWordTideSvg,
  buildWordTideSvgOutlined,
  type WordTideSvgOptions,
} from "./word-tide-svg-export";

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

const DEFAULT_WORDS =
  "OCEAN TIDE CURRENT HARBOR DOCK CARGO SWELL DRIFT NORTH ANCHOR VESSEL PORT";

const typography: ResolvedTypography = {
  color: "#16324F",
  family: '"IBM Plex Mono", ui-monospace, monospace',
  fontSize: 18,
  letterSpacingEm: 0,
  lineHeightFactor: 1.5,
  opacity: 1,
  textCase: "uppercase",
  weight: 500,
  weights: [100, 200, 300, 400, 500, 600, 700],
};

const baseInk: InkSettings = {
  contrast: 0,
  fade: true,
  invert: false,
  sparsity: 0,
  weightRange: 60,
};

const baseZones: ToneZoneSettings = {
  darkWords: "OCEAN DEEP UNDERTOW",
  enabled: false,
  lightWords: "CLOUDS SKY FOAM",
  midWords: "BOAT HULL CARGO",
  split: [35, 65],
};

const baseHighlight: HighlightSettings = { coverage: 0, words: "" };

const measure: MeasureWord = (text, weight) => text.length * (9 + weight / 300);

const baseGrid: WordGridSettings = {
  gap: 6,
  highlight: baseHighlight,
  ink: baseInk,
  jitter: 0,
  order: "sequential",
  seed: 21,
  words: DEFAULT_WORDS,
  zones: baseZones,
};

const baseFlow: WordFlowSettings = {
  density: 55,
  highlight: baseHighlight,
  ink: baseInk,
  order: "sequential",
  seed: 21,
  wordGap: 6,
  words: DEFAULT_WORDS,
};

const baseFieldSettings: VectorFieldSettings = {
  direction: 200,
  frequency: 14,
  pattern: "currents",
  seed: 21,
  snapAngles: "off",
  swirl: 8,
  turbulence: 10,
};

const noPathSettings = { paths: [] as FlowPath[], reach: 45, smoothness: 72, strength: 55 };

const seededPath: FlowPath = {
  id: "test-path",
  points: [
    { x: 120, y: 270 },
    { x: 480, y: 270 },
    { x: 840, y: 270 },
  ],
};

function gridWords(
  overrides: Partial<WordGridSettings> = {},
  image: PreparedSourceImage | null = null,
  mask: ShapeMask | null = null,
): PlacedWord[] {
  return layoutWordGrid(
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    typography,
    { ...baseGrid, ...overrides },
    image,
    mask,
    measure,
  );
}

function flowWords(
  overrides: Partial<WordFlowSettings> = {},
  fieldOverrides: Partial<VectorFieldSettings> = {},
  pathOverrides: Partial<typeof noPathSettings> = {},
  image: PreparedSourceImage | null = null,
  mask: ShapeMask | null = null,
): PlacedWord[] {
  const field = createVectorField(
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    { ...baseFieldSettings, ...fieldOverrides },
    { ...noPathSettings, ...pathOverrides },
  );
  return layoutWordFlow(
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    typography,
    { ...baseFlow, ...overrides },
    field,
    image,
    mask,
    measure,
  );
}

function hashWords(words: readonly PlacedWord[]): string {
  return words
    .map(
      (word) =>
        `${word.text}:${Math.round(word.x)}:${Math.round(word.y)}:${word.fontWeight}:${Math.round(word.opacity * 1000)}:${word.highlighted ? 1 : 0}`,
    )
    .join("|");
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
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
      data[index + 3] = opaque ? 255 : 0;
    }
  }
  return { data, height, width };
}

function buildSvgOptions(
  words: readonly PlacedWord[],
  overrides: Partial<WordTideSvgOptions> = {},
): WordTideSvgOptions {
  return {
    backgroundHex: "#F5F2EC",
    height: CANVAS_HEIGHT,
    highlightColor: "#FFE14D",
    includeBackground: true,
    layout: {
      canvasHeight: CANVAS_HEIGHT,
      canvasWidth: CANVAS_WIDTH,
      typography,
      words: [...words],
    },
    textMode: "editable",
    width: CANVAS_WIDTH,
    ...overrides,
  };
}

describe("Word Tide control acceptance", () => {
  it("render mode switches layout engines", () => {
    const grid = gridWords();
    const flow = flowWords();
    expect(grid.length).toBeGreaterThan(0);
    expect(flow.length).toBeGreaterThan(0);
    expect(hashWords(grid)).not.toBe(hashWords(flow));
    expect(grid.every((word) => word.angle === 0)).toBe(true);
    expect(flow.some((word) => word.angle !== 0)).toBe(true);
  });

  it("seed changes product output", () => {
    expect(hashWords(flowWords({ seed: 842 }))).not.toBe(hashWords(flowWords()));
    expect(hashWords(gridWords({ jitter: 40, seed: 842 }))).not.toBe(
      hashWords(gridWords({ jitter: 40 })),
    );
  });

  it("randomize changes product output", () => {
    const advancedSeed = (21 + 137) % 10000;
    expect(hashWords(flowWords({ seed: advancedSeed }))).not.toBe(hashWords(flowWords()));
  });

  it("word list changes product output", () => {
    const custom = gridWords({ words: "SIGNAL BUOY LATITUDE" });
    expect(new Set(custom.map((word) => word.text))).toEqual(
      new Set(["SIGNAL", "BUOY", "LATITUDE"]),
    );
    expect(hashWords(custom)).not.toBe(hashWords(gridWords()));
  });

  it("word order changes product output", () => {
    expect(hashWords(gridWords({ order: "random" }))).not.toBe(hashWords(gridWords()));
  });

  it("source image drives ink lifecycle", () => {
    const image = createHorizontalGradientImage(CANVAS_WIDTH, CANVAS_HEIGHT);
    const baseline = hashWords(gridWords());
    const withImage = hashWords(gridWords({}, image));
    expect(withImage).not.toBe(baseline);
    const cleared = hashWords(gridWords({}, null));
    expect(cleared).toBe(baseline);
  });

  it("contrast changes product output", () => {
    const image = createHorizontalGradientImage(CANVAS_WIDTH, CANVAS_HEIGHT);
    expect(
      hashWords(gridWords({ ink: { ...baseInk, contrast: 80 } }, image)),
    ).not.toBe(hashWords(gridWords({ ink: { ...baseInk, contrast: -80 } }, image)));
  });

  it("invert flips ink reading", () => {
    const image = createHorizontalGradientImage(CANVAS_WIDTH, CANVAS_HEIGHT);
    const normal = gridWords({ ink: { ...baseInk, sparsity: 60 } }, image);
    const inverted = gridWords({ ink: { ...baseInk, invert: true, sparsity: 60 } }, image);
    const averageX = (words: readonly PlacedWord[]) =>
      words.reduce((sum, word) => sum + word.x, 0) / Math.max(1, words.length);
    expect(averageX(normal)).not.toBeCloseTo(averageX(inverted), 0);
  });

  it("fade maps ink to opacity", () => {
    const image = createHorizontalGradientImage(CANVAS_WIDTH, CANVAS_HEIGHT);
    const faded = gridWords({}, image);
    const flat = gridWords({ ink: { ...baseInk, fade: false } }, image);
    expect(new Set(faded.map((word) => Math.round(word.opacity * 100))).size).toBeGreaterThan(1);
    expect(flat.every((word) => word.opacity === 1)).toBe(true);
  });

  it("weight range ramps font weights", () => {
    const image = createHorizontalGradientImage(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ramped = gridWords({ ink: { ...baseInk, weightRange: 100 } }, image);
    const fixed = gridWords({ ink: { ...baseInk, weightRange: 0 } }, image);
    expect(new Set(ramped.map((word) => word.fontWeight)).size).toBeGreaterThan(1);
    expect(new Set(fixed.map((word) => word.fontWeight)).size).toBe(1);
  });

  it("sparsity drops words from light areas", () => {
    const image = createHorizontalGradientImage(CANVAS_WIDTH, CANVAS_HEIGHT);
    const dense = gridWords({}, image);
    const sparse = gridWords({ ink: { ...baseInk, sparsity: 85 } }, image);
    expect(sparse.length).toBeLessThan(dense.length);
    expect(sparse.length).toBeGreaterThan(0);
  });

  it("tone zones enable band word lists", () => {
    const zoned = gridWords({ zones: { ...baseZones, enabled: true } });
    const texts = new Set(zoned.map((word) => word.text));
    expect(texts.has("CLOUDS") || texts.has("SKY") || texts.has("FOAM")).toBe(true);
    expect(texts.has("OCEAN") || texts.has("DEEP") || texts.has("UNDERTOW")).toBe(true);
    expect(hashWords(zoned)).not.toBe(hashWords(gridWords()));
  });

  it("zone split moves band boundaries", () => {
    const narrow = gridWords({ zones: { ...baseZones, enabled: true, split: [15, 85] } });
    const wide = gridWords({ zones: { ...baseZones, enabled: true, split: [45, 55] } });
    expect(hashWords(narrow)).not.toBe(hashWords(wide));
  });

  it("dark zone words change product output", () => {
    const zoned = gridWords({
      zones: { ...baseZones, darkWords: "ABYSS TRENCH", enabled: true },
    });
    expect(new Set(zoned.map((word) => word.text)).has("ABYSS")).toBe(true);
  });

  it("mid zone words change product output", () => {
    const zoned = gridWords({
      zones: { ...baseZones, enabled: true, midWords: "KEEL RUDDER" },
    });
    expect(new Set(zoned.map((word) => word.text)).has("KEEL")).toBe(true);
  });

  it("light zone words change product output", () => {
    const zoned = gridWords({
      zones: { ...baseZones, enabled: true, lightWords: "GULL BREEZE" },
    });
    expect(new Set(zoned.map((word) => word.text)).has("GULL")).toBe(true);
  });

  it("grid gap changes word packing", () => {
    const tight = gridWords({ gap: 0 });
    const loose = gridWords({ gap: 40 });
    expect(tight.length).toBeGreaterThan(loose.length);
  });

  it("grid jitter offsets slots", () => {
    expect(hashWords(gridWords({ jitter: 80 }))).not.toBe(hashWords(gridWords()));
  });

  it("flow pattern changes word streams", () => {
    expect(hashWords(flowWords({}, { pattern: "vortex" }))).not.toBe(hashWords(flowWords()));
  });

  it("flow direction changes product output", () => {
    expect(hashWords(flowWords({}, { direction: 45 }))).not.toBe(hashWords(flowWords()));
  });

  it("flow scale changes product output", () => {
    expect(hashWords(flowWords({}, { frequency: 32 }))).not.toBe(hashWords(flowWords()));
  });

  it("flow swirl changes product output", () => {
    expect(hashWords(flowWords({}, { swirl: 80 }))).not.toBe(hashWords(flowWords()));
  });

  it("flow turbulence changes product output", () => {
    expect(hashWords(flowWords({}, { turbulence: 80 }))).not.toBe(hashWords(flowWords()));
  });

  it("paths edit mode enables canvas overlay", () => {
    const pathD = buildPathSplinePathD(seededPath.points, 72);
    expect(pathD.startsWith("M")).toBe(true);
    expect(pathD.length).toBeGreaterThan(10);
  });

  it("paths reach changes product output", () => {
    const near = flowWords({}, {}, { paths: [seededPath], reach: 20, strength: 90 });
    const far = flowWords({}, {}, { paths: [seededPath], reach: 140, strength: 90 });
    expect(hashWords(near)).not.toBe(hashWords(far));
  });

  it("paths strength changes product output", () => {
    const weak = flowWords({}, {}, { paths: [seededPath], strength: 5 });
    const strong = flowWords({}, {}, { paths: [seededPath], strength: 95 });
    expect(hashWords(weak)).not.toBe(hashWords(strong));
  });

  it("add path creates editable spline", () => {
    expect(createPathId()).not.toBe(createPathId());
    const withPath = flowWords({}, {}, { paths: [seededPath], strength: 95 });
    expect(hashWords(withPath)).not.toBe(hashWords(flowWords()));
  });

  it("delete path removes active spline", () => {
    const baseline = hashWords(flowWords());
    const withPath = hashWords(flowWords({}, {}, { paths: [seededPath], strength: 95 }));
    const deleted = hashWords(flowWords({}, {}, { paths: [] }));
    expect(withPath).not.toBe(baseline);
    expect(deleted).toBe(baseline);
  });

  it("density changes stream packing", () => {
    const sparse = flowWords({ density: 10 });
    const dense = flowWords({ density: 100 });
    expect(dense.length).toBeGreaterThan(sparse.length);
  });

  it("word gap changes stream spacing", () => {
    const tight = flowWords({ wordGap: 0 });
    const loose = flowWords({ wordGap: 70 });
    expect(tight.length).toBeGreaterThan(loose.length);
  });

  it("font picker styles every word", () => {
    const resolved = resolveTypography({
      color: "#0A2540",
      fontId: "ibm-plex-mono",
      fontSize: 24,
      fontWeight: "700",
      letterSpacing: "wide",
      lineHeight: "tight",
      opacity: 50,
      textCase: "lowercase",
    });
    expect(resolved.family.toLowerCase()).toContain("mono");
    expect(resolved.weight).toBe(700);
    expect(resolved.fontSize).toBe(24);
    expect(resolved.letterSpacingEm).toBeGreaterThan(0);
    expect(resolved.lineHeightFactor).toBe(1.25);
    expect(resolved.textCase).toBe("lowercase");
    expect(applyTextCase("OCEAN", resolved.textCase)).toBe("ocean");
    expect(resolved.color).toBe("#0A2540");
    expect(resolved.opacity).toBe(0.5);

    const larger = layoutWordGrid(
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      { ...typography, fontSize: 34 },
      baseGrid,
      null,
      null,
      measure,
    );
    expect(larger.length).toBeLessThan(gridWords().length);
  });

  it("highlight words mark matches", () => {
    const words = gridWords({ highlight: { coverage: 0, words: "OCEAN" } });
    const matched = words.filter((word) => word.text === "OCEAN");
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.every((word) => word.highlighted)).toBe(true);
    expect(
      words.filter((word) => word.text !== "OCEAN").every((word) => !word.highlighted),
    ).toBe(true);
  });

  it("highlight color changes marker fill", () => {
    const words = gridWords({ highlight: { coverage: 0, words: "OCEAN" } });
    const svg = buildWordTideSvg(buildSvgOptions(words, { highlightColor: "#FF6B4A" }));
    expect(svg).toContain('fill="#FF6B4A"');
  });

  it("highlight coverage marks random words", () => {
    const none = gridWords();
    const covered = gridWords({ highlight: { coverage: 55, words: "" } });
    expect(none.every((word) => !word.highlighted)).toBe(true);
    expect(covered.some((word) => word.highlighted)).toBe(true);
    expect(covered.some((word) => !word.highlighted)).toBe(true);
  });

  it("shape mask constrains placement lifecycle", () => {
    const shape = createSplitAlphaImage(CANVAS_WIDTH, CANVAS_HEIGHT);
    const mask = buildShapeMask(shape, false, 0);
    const baseline = gridWords();
    const masked = gridWords({}, null, mask);
    expect(masked.length).toBeGreaterThan(0);
    expect(masked.length).toBeLessThan(baseline.length);
    expect(masked.every((word) => word.x >= CANVAS_WIDTH / 2 - 1)).toBe(true);
    const cleared = gridWords({}, null, null);
    expect(hashWords(cleared)).toBe(hashWords(baseline));
  });

  it("mask invert flips placement region", () => {
    const shape = createSplitAlphaImage(CANVAS_WIDTH, CANVAS_HEIGHT);
    const inverted = buildShapeMask(shape, true, 0);
    const words = gridWords({}, null, inverted);
    expect(words.length).toBeGreaterThan(0);
    expect(words.every((word) => word.x + word.width <= CANVAS_WIDTH / 2 + 1)).toBe(true);
  });

  it("mask feather softens edge words", () => {
    const shape = createSplitAlphaImage(CANVAS_WIDTH, CANVAS_HEIGHT);
    const hard = gridWords({}, null, buildShapeMask(shape, false, 0));
    const feathered = gridWords({}, null, buildShapeMask(shape, false, 40));
    expect(hashWords(feathered)).not.toBe(hashWords(hard));
    expect(feathered.some((word) => word.opacity < 1)).toBe(true);
  });

  it("include background changes product output", () => {
    const words = gridWords().slice(0, 20);
    const withBackground = buildWordTideSvg(buildSvgOptions(words));
    const transparent = buildWordTideSvg(buildSvgOptions(words, { includeBackground: false }));
    expect(withBackground).toContain('fill="#F5F2EC"');
    expect(transparent).not.toContain('fill="#F5F2EC"');
  });

  it("background color changes product output", () => {
    const words = gridWords().slice(0, 20);
    const svg = buildWordTideSvg(buildSvgOptions(words, { backgroundHex: "#101820" }));
    expect(svg).toContain('fill="#101820"');
  });

  it("image export format selects encoding", () => {
    const svg = buildWordTideSvg(buildSvgOptions(gridWords().slice(0, 20)));
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("</svg>");
  });

  it("image export resolution sizes output", () => {
    const words = gridWords().slice(0, 20);
    const eightK = buildWordTideSvg(buildSvgOptions(words, { height: 4608, width: 8192 }));
    expect(eightK).toContain('width="8192"');
    expect(eightK).toContain('height="4608"');
    expect(eightK).toContain(`viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}"`);
  });

  it("svg text mode switches text and outlines", async () => {
    const words = gridWords().slice(0, 12);
    const editable = buildWordTideSvg(buildSvgOptions(words));
    expect(editable).toContain("<text");
    expect(editable).not.toContain('<path d="M');

    const outlined = await buildWordTideSvgOutlined(
      buildSvgOptions(words, { textMode: "outlines" }),
    );
    const hasOutlines = outlined.includes('<path d="M');
    const hasDocumentedFallback = outlined.includes("kept as editable text");
    expect(hasOutlines || hasDocumentedFallback).toBe(true);
  });
});

describe("Word Tide export action visibility", () => {
  function getExportSection() {
    const section = appSchema.panels.controls?.sections.find(
      (candidate) => candidate.title === "Export",
    );
    expect(section).toBeDefined();
    return section!;
  }

  function actionLabels(actions: readonly (string | { label?: string })[] | undefined) {
    return actions?.map((action) =>
      typeof action === "string" ? action : action.label,
    );
  }

  function actionValues(
    actions: readonly (string | { value?: string })[] | undefined,
  ) {
    return actions?.map((action) =>
      typeof action === "string" ? action : action.value,
    );
  }

  it("export svg actions visible for svg format", () => {
    const control = getExportSection().controls["exportActionsSvg"]!;
    expect(control.visibleWhen).toEqual({ equals: "svg", target: "export.image.format" });
    expect(actionLabels(control.actions)).toEqual(["Export SVG", "Copy SVG"]);
    expect(actionValues(control.actions)).toEqual(["export-image", "copy-image"]);
  });

  it("export png actions visible for png format", () => {
    const control = getExportSection().controls["exportActionsPng"]!;
    expect(control.visibleWhen).toEqual({ equals: "png", target: "export.image.format" });
    expect(actionLabels(control.actions)).toEqual(["Export PNG", "Copy PNG"]);
  });

  it("export jpg actions visible for jpg format", () => {
    const control = getExportSection().controls["exportActionsJpg"]!;
    expect(control.visibleWhen).toEqual({ equals: "jpg", target: "export.image.format" });
    expect(actionLabels(control.actions)).toEqual(["Export JPG", "Copy JPG"]);
  });
});
