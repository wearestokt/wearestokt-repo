import { describe, expect, it } from "vitest";

import { validateToolcraftPerformanceCoverage } from "@/toolcraft/runtime";

import { appAcceptance, appTransferMode, starterControlSectionInventory, validateToolcraftAcceptanceCoverage } from "./app-acceptance";
import { appPerformance } from "./app-performance";
import { appSchema } from "./app-schema";
import { sampleWeightedColor } from "./flow-color-ramp";
import { defaultFlowPaletteSettings } from "./flow-palette";
import { defaultFlowPathSettings } from "./flow-path-math";
import { createVectorField } from "./flow-vector-field";
import { buildStrokeRibbon, ribbonToPolygon } from "./flow-stroke-geometry";
import { buildFlowOutput, computeStrokeLength } from "./flow-streamline-math";

const baseField = {
  direction: 200,
  frequency: 14,
  pattern: "currents" as const,
  seed: 21,
  snapAngles: "off" as const,
  swirl: 8,
  turbulence: 10,
};

const baseStreams = {
  density: 24,
  gap: 4,
  lengthContrast: 50,
  lengthMax: 120,
  lengthMin: 12,
  margin: 24,
  smoothness: 60,
  spacingMode: "even" as const,
};

function getSectionTitles(): string[] {
  return (appSchema.panels.controls?.sections ?? [])
    .map((section) => section.title)
    .filter((title): title is string => typeof title === "string");
}

describe("Flow Field 3.0 app schema", () => {
  it("renders the product control sections in workflow order", () => {
    const titles = getSectionTitles();
    expect(titles).toEqual([
      "Setup",
      "Flow Paths",
      "Field",
      "Streams",
      "Stroke",
      "Palette",
      "Background",
      "Image Export",
      "Export",
    ]);
  });

  it("uses an editable-output Canvas 2D product canvas without upload", () => {
    expect(appSchema.canvas.enabled).toBe(true);
    expect(appSchema.canvas.upload).toBe(false);
    expect(appSchema.canvas.sizing).toEqual({ mode: "editable-output" });
    expect(appSchema.canvas.renderScale.enabled).toBe(true);
  });

  it("passes acceptance and performance coverage validators", () => {
    expect(
      validateToolcraftAcceptanceCoverage(appSchema, appAcceptance, appTransferMode, starterControlSectionInventory),
    ).toEqual([]);
    expect(validateToolcraftPerformanceCoverage(appSchema, appPerformance)).toEqual([]);
  });
});

describe("flow vector field", () => {
  it("blends path tangent inside reach when strength is high", () => {
    const proceduralOnly = createVectorField(1920, 1080, baseField, {
      paths: [],
      reach: 50,
      smoothness: 72,
      strength: 0,
    });
    const withPath = createVectorField(1920, 1080, baseField, {
      paths: [
        {
          id: "p1",
          points: [
            { x: 100, y: 540 },
            { x: 960, y: 540 },
            { x: 1820, y: 540 },
          ],
        },
      ],
      reach: 80,
      smoothness: 72,
      strength: 100,
    });
    const nearPath = withPath.sample(960, 520);
    const farAway = proceduralOnly.sample(960, 520);
    expect(Math.abs(nearPath.angle - farAway.angle)).toBeGreaterThan(0.05);
  });
});

describe("flow streamline math", () => {
  it("respects even-spacing separation between seeds", () => {
    const output = buildFlowOutput(
      960,
      540,
      baseField,
      defaultFlowPathSettings,
      baseStreams,
      "line",
      2,
      defaultFlowPaletteSettings,
    );
    expect(output.strokes.length).toBeGreaterThan(3);
    const minDist = 18;
    for (let i = 0; i < output.strokes.length; i += 1) {
      const a = output.strokes[i]!.points[0]!;
      for (let j = i + 1; j < output.strokes.length; j += 1) {
        const b = output.strokes[j]!.points[0]!;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance > 0 && distance < minDist) {
          expect(distance).toBeGreaterThanOrEqual(minDist * 0.55);
        }
      }
    }
  });

  it("shortens strokes under high length contrast and curvature", () => {
    const long = computeStrokeLength(0.9, 0.05, 0, 20, 200);
    const short = computeStrokeLength(0.2, 0.9, 100, 20, 200);
    expect(short).toBeLessThan(long);
  });
});

describe("flow stroke geometry", () => {
  it("builds taper ribbon polygons with more than two vertices", () => {
    const stroke = {
      arcT: [0, 0.5, 1],
      pointSpeeds: [0.4, 0.6, 0.8],
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 10 },
        { x: 100, y: 0 },
      ],
      sizeClass: "base" as const,
      style: "line" as const,
      thickness: 4,
    };
    const polygon = ribbonToPolygon(buildStrokeRibbon(stroke, { taper: "both", widthBySpeed: 50 }));
    expect(polygon.length).toBeGreaterThanOrEqual(6);
  });
});

describe("flow palette", () => {
  it("samples weighted palette colors", () => {
    const low = sampleWeightedColor(
      [
        { hex: "#000000", weight: 100 },
        { hex: "#FFFFFF", weight: 0 },
      ],
      0.1,
    );
    const high = sampleWeightedColor(
      [
        { hex: "#000000", weight: 0 },
        { hex: "#FFFFFF", weight: 100 },
      ],
      0.9,
    );
    expect(low).not.toEqual(high);
  });
});
