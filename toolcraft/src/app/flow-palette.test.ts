import { describe, expect, it } from "vitest";

import {
  assignStrokeColor,
  defaultFlowPaletteSettings,
  normalizePaletteWeights,
  paletteBackgroundForSettings,
  resolvePaletteColors,
  sampleWeightedColor,
} from "./flow-palette";
import type { FlowStroke } from "./flow-streamline-math";

describe("flow-palette", () => {
  it("resolves preset palette colors", () => {
    const colors = resolvePaletteColors({
      ...defaultFlowPaletteSettings,
      presetId: "ocean",
    });
    expect(colors.length).toBeGreaterThanOrEqual(4);
  });

  it("resolves custom palette slots", () => {
    const colors = resolvePaletteColors({
      ...defaultFlowPaletteSettings,
      customSlots: [
        { hex: "#111111", weight: 20 },
        { hex: "#222222", weight: 20 },
        { hex: "#333333", weight: 20 },
        { hex: "#444444", weight: 20 },
        { hex: "#555555", weight: 20 },
      ],
      presetId: "custom",
    });
    expect(colors).toHaveLength(5);
  });

  it("samples weighted colors deterministically", () => {
    const slots = [
      { hex: "#AA0000", weight: 100 },
      { hex: "#00AA00", weight: 0 },
    ];
    expect(sampleWeightedColor(slots, 0.2)).toBe("#AA0000");
    expect(sampleWeightedColor(slots, 0.99)).toBe("#AA0000");
  });

  it("pairs palette backgrounds", () => {
    expect(paletteBackgroundForSettings({ ...defaultFlowPaletteSettings, presetId: "ember" })).toBe(
      "#1A0A05",
    );
  });

  it("normalizes uneven weights", () => {
    const normalized = normalizePaletteWeights([
      { hex: "#111111", weight: 10 },
      { hex: "#222222", weight: 30 },
    ]);
    expect(normalized[0]!.weight).toBeCloseTo(25, 4);
    expect(normalized[1]!.weight).toBeCloseTo(75, 4);
  });

  it("assigns inheritance from neighbors", () => {
    const neighbor: FlowStroke = {
      arcT: [0, 1],
      colorHex: "#ABCDEF",
      pointSpeeds: [0.4, 0.6],
      points: [
        { x: 100, y: 100 },
        { x: 120, y: 100 },
      ],
      sizeClass: "base",
      style: "line",
      thickness: 2,
    };
    const candidate: FlowStroke = {
      arcT: [0, 1],
      pointSpeeds: [0.4, 0.6],
      points: [
        { x: 105, y: 100 },
        { x: 115, y: 100 },
      ],
      sizeClass: "base",
      style: "line",
      thickness: 2,
    };
    const color = assignStrokeColor(
      candidate,
      { ...defaultFlowPaletteSettings, assignmentMode: "inheritance" },
      42,
      540,
      [neighbor],
      105,
      100,
      50,
    );
    expect(color).toBe("#ABCDEF");
  });
});
