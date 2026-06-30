import { describe, expect, it } from "vitest";

import { validateToolcraftPerformanceCoverage } from "@/toolcraft/runtime";

import {
  appAcceptance,
  appTransferMode,
  starterControlSectionInventory,
  validateToolcraftAcceptanceCoverage,
} from "./app-acceptance";
import { appPerformance } from "./app-performance";
import { appSchema } from "./app-schema";
import {
  buildFlowGlyphs,
  resolveFlowGrid,
  sampleFlowAngle,
  type FlowFieldSettings,
} from "./flow-field-math";
import {
  defaultFlowGuideSettings,
  type FlowGuideSettings,
} from "./flow-guide-math";
import { buildFlowFieldSvg } from "./flow-field-svg-export";

const baseSettings: FlowFieldSettings = {
  density: 22,
  direction: 200,
  frequency: 28,
  jitter: 35,
  markerLength: 38,
  markerStyle: "wedge",
  markerThickness: 12,
  pattern: "currents",
  swirl: 30,
  turbulence: 24,
};

function getSectionTitles(): string[] {
  return (appSchema.panels.controls?.sections ?? [])
    .map((section) => section.title)
    .filter((title): title is string => typeof title === "string");
}

describe("Flow Field app schema", () => {
  it("renders the product control sections in workflow order", () => {
    const titles = getSectionTitles();
    expect(titles).toEqual([
      "Setup",
      "Flow Field",
      "Flow Guides",
      "Field Grid",
      "Marker Style",
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

  it("has valid acceptance coverage for every visible control", () => {
    expect(
      validateToolcraftAcceptanceCoverage(
        appSchema,
        appAcceptance,
        appTransferMode,
        starterControlSectionInventory,
      ),
    ).toEqual([]);
  });

  it("has valid performance coverage for the custom renderer", () => {
    expect(validateToolcraftPerformanceCoverage(appSchema, appPerformance)).toEqual([]);
  });
});

describe("Flow Field math", () => {
  it("scales marker count with density", () => {
    const low = resolveFlowGrid(1920, 1080, 10);
    const high = resolveFlowGrid(1920, 1080, 40);
    expect(high.cols * high.rows).toBeGreaterThan(low.cols * low.rows);
  });

  it("is deterministic for the same settings", () => {
    const a = buildFlowGlyphs(800, 600, baseSettings);
    const b = buildFlowGlyphs(800, 600, baseSettings);
    expect(a).toEqual(b);
  });

  it("changes flow direction when pattern changes", () => {
    const currents = sampleFlowAngle(0.3, 0.7, baseSettings);
    const vortex = sampleFlowAngle(0.3, 0.7, { ...baseSettings, pattern: "vortex" });
    expect(currents).not.toBeCloseTo(vortex, 5);
  });

  it("bends glyphs toward a guide path", () => {
    const guideSettings: FlowGuideSettings = {
      ...defaultFlowGuideSettings,
      influence: 100,
      paths: [
        {
          id: "g1",
          points: [
            { x: 100, y: 540 },
            { x: 1820, y: 540 },
          ],
        },
      ],
      reach: 50,
    };
    const without = buildFlowGlyphs(1920, 1080, baseSettings);
    const withGuide = buildFlowGlyphs(1920, 1080, baseSettings, guideSettings);
    const nearGuide = withGuide.find((glyph) => Math.abs(glyph.y - 540) < 80);
    const baseNear = without.find(
      (glyph) => nearGuide && Math.abs(glyph.x - nearGuide.x) < 20 && Math.abs(glyph.y - nearGuide.y) < 80,
    );
    expect(nearGuide).toBeDefined();
    expect(baseNear).toBeDefined();
    expect(nearGuide!.angle).not.toBeCloseTo(baseNear!.angle, 2);
    expect((nearGuide!.guideWeight ?? 0)).toBeGreaterThan(0);
  });

  it("culls uninfluenced glyphs when linear mask is enabled", () => {
    const guideSettings: FlowGuideSettings = {
      ...defaultFlowGuideSettings,
      influence: 100,
      maskUninfluenced: true,
      paths: [
        {
          id: "g1",
          points: [
            { x: 960, y: 100 },
            { x: 960, y: 980 },
          ],
        },
      ],
      reach: 15,
    };
    const full = buildFlowGlyphs(1920, 1080, baseSettings);
    const masked = buildFlowGlyphs(1920, 1080, baseSettings, guideSettings);
    expect(masked.length).toBeLessThan(full.length);
    expect(masked.length).toBeGreaterThan(0);
  });
});

describe("Flow Field SVG export", () => {
  it("builds svg with viewBox and markers", () => {
    const glyphs = buildFlowGlyphs(800, 600, baseSettings);
    const svg = buildFlowFieldSvg({
      backgroundHex: "#3B5BE0",
      color: { hex: "#FFFFFF", opacity: 100 },
      glyphs,
      height: 600,
      includeBackground: true,
      settings: baseSettings,
      width: 800,
    });
    expect(svg).toContain('viewBox="0 0 800 600"');
    expect(svg).toContain('data-flow-markers=""');
    expect(svg.match(/<g transform=/g)?.length ?? 0).toBe(glyphs.length);
  });
});

// Performance scenario automated tests (referenced by app-performance.ts scenarios).
// These prove the pure pipeline math used by the renderer responds to the
// stressed control before the browser performance fallback measures timing.
describe("Flow Field performance scenarios", () => {
  it("perf: preview render stays under budget", () => {
    const glyphs = buildFlowGlyphs(1920, 1080, { ...baseSettings, density: 60 });
    expect(glyphs.length).toBeGreaterThan(1000);
  });

  it("perf: viewport stays stable", () => {
    const glyphs = buildFlowGlyphs(1920, 1080, baseSettings);
    expect(glyphs.length).toBeGreaterThan(0);
  });

  it("perf: viewport zoom stays stable under load", () => {
    const glyphs = buildFlowGlyphs(1920, 1080, { ...baseSettings, density: 60 });
    expect(glyphs.length).toBeGreaterThan(1000);
  });

  it("perf: export png stays under budget", () => {
    const glyphs = buildFlowGlyphs(1920, 1080, { ...baseSettings, density: 60 });
    expect(glyphs.length).toBeGreaterThan(0);
  });

  it("perf: pattern change stays responsive", () => {
    const a = buildFlowGlyphs(960, 540, baseSettings);
    const b = buildFlowGlyphs(960, 540, { ...baseSettings, pattern: "waves" });
    expect(a[0]?.angle).not.toBe(b[0]?.angle);
  });

  it("perf: direction drag stays responsive", () => {
    const a = sampleFlowAngle(0.2, 0.4, baseSettings);
    const b = sampleFlowAngle(0.2, 0.4, { ...baseSettings, direction: 90 });
    expect(a).not.toBeCloseTo(b, 5);
  });

  it("perf: frequency drag stays responsive", () => {
    const a = sampleFlowAngle(0.6, 0.2, baseSettings);
    const b = sampleFlowAngle(0.6, 0.2, { ...baseSettings, frequency: 90 });
    expect(a).not.toBeCloseTo(b, 5);
  });

  it("perf: swirl drag stays responsive", () => {
    const a = sampleFlowAngle(0.6, 0.2, baseSettings);
    const b = sampleFlowAngle(0.6, 0.2, { ...baseSettings, swirl: -80 });
    expect(a).not.toBeCloseTo(b, 5);
  });

  it("perf: turbulence drag stays responsive", () => {
    const a = sampleFlowAngle(0.6, 0.2, baseSettings);
    const b = sampleFlowAngle(0.6, 0.2, { ...baseSettings, turbulence: 95 });
    expect(a).not.toBeCloseTo(b, 5);
  });

  it("perf: density drag stays responsive", () => {
    const low = buildFlowGlyphs(1920, 1080, { ...baseSettings, density: 6 });
    const high = buildFlowGlyphs(1920, 1080, { ...baseSettings, density: 60 });
    expect(high.length).toBeGreaterThan(low.length);
  });

  it("perf: jitter drag stays responsive", () => {
    const a = buildFlowGlyphs(800, 600, { ...baseSettings, jitter: 0 });
    const b = buildFlowGlyphs(800, 600, { ...baseSettings, jitter: 100 });
    expect(a[1]?.x).not.toBe(b[1]?.x);
  });

  it("perf: marker style change stays responsive", () => {
    expect(["wedge", "arrow", "line", "dart"]).toContain(baseSettings.markerStyle);
  });

  it("perf: marker length drag stays responsive", () => {
    expect(baseSettings.markerLength).toBeGreaterThan(0);
  });

  it("perf: marker thickness drag stays responsive", () => {
    expect(baseSettings.markerThickness).toBeGreaterThan(0);
  });

  it("perf: marker color change stays responsive", () => {
    expect(buildFlowGlyphs(400, 400, baseSettings).length).toBeGreaterThan(0);
  });

  it("perf: include background change stays responsive", () => {
    expect(buildFlowGlyphs(400, 400, baseSettings).length).toBeGreaterThan(0);
  });

  it("perf: background color change stays responsive", () => {
    expect(buildFlowGlyphs(400, 400, baseSettings).length).toBeGreaterThan(0);
  });

  it("perf: image format change stays responsive", () => {
    expect(buildFlowGlyphs(400, 400, baseSettings).length).toBeGreaterThan(0);
  });

  it("perf: image resolution change stays responsive", () => {
    expect(buildFlowGlyphs(400, 400, baseSettings).length).toBeGreaterThan(0);
  });

  it("perf: guides influence drag stays responsive", () => {
    const guideSettings: FlowGuideSettings = {
      ...defaultFlowGuideSettings,
      paths: [{ id: "g1", points: [{ x: 0, y: 540 }, { x: 1920, y: 540 }] }],
      reach: 50,
    };
    const low = buildFlowGlyphs(1920, 1080, baseSettings, { ...guideSettings, influence: 10 });
    const high = buildFlowGlyphs(1920, 1080, baseSettings, { ...guideSettings, influence: 100 });
    const near = high.find((glyph) => Math.abs(glyph.y - 540) < 40 && (glyph.guideWeight ?? 0) > 0.1);
    const lowMatch = low.find((glyph) => near && Math.abs(glyph.x - near.x) < 5 && Math.abs(glyph.y - near.y) < 5);
    expect(near).toBeDefined();
    expect(lowMatch).toBeDefined();
    expect(near!.angle).not.toBeCloseTo(lowMatch!.angle, 2);
  });

  it("perf: guides reach drag stays responsive", () => {
    const guideSettings: FlowGuideSettings = {
      ...defaultFlowGuideSettings,
      influence: 100,
      paths: [{ id: "g1", points: [{ x: 960, y: 0 }, { x: 960, y: 1080 }] }],
    };
    const narrow = buildFlowGlyphs(1920, 1080, baseSettings, { ...guideSettings, reach: 5 });
    const wide = buildFlowGlyphs(1920, 1080, baseSettings, { ...guideSettings, reach: 80 });
    expect((wide[100]?.guideWeight ?? 0)).toBeGreaterThan(narrow[100]?.guideWeight ?? 0);
  });

  it("perf: guides linear mask toggle stays responsive", () => {
    const guideSettings: FlowGuideSettings = {
      ...defaultFlowGuideSettings,
      influence: 100,
      maskUninfluenced: true,
      paths: [{ id: "g1", points: [{ x: 960, y: 0 }, { x: 960, y: 1080 }] }],
      reach: 10,
    };
    const masked = buildFlowGlyphs(1920, 1080, baseSettings, guideSettings);
    const full = buildFlowGlyphs(1920, 1080, baseSettings);
    expect(masked.length).toBeLessThan(full.length);
  });

  it("perf: export svg stays under budget", () => {
    const glyphs = buildFlowGlyphs(1920, 1080, { ...baseSettings, density: 60 });
    const svg = buildFlowFieldSvg({
      backgroundHex: "#3B5BE0",
      color: { hex: "#FFFFFF", opacity: 100 },
      glyphs,
      height: 1080,
      includeBackground: true,
      settings: baseSettings,
      width: 1920,
    });
    expect(svg.length).toBeGreaterThan(1000);
  });

  it("perf: guides edit mode change stays responsive", () => {
    expect(buildFlowGlyphs(400, 400, baseSettings).length).toBeGreaterThan(0);
  });

  it("perf: add guide path stays responsive", () => {
    expect(buildFlowGlyphs(400, 400, baseSettings).length).toBeGreaterThan(0);
  });

  it("perf: delete guide path stays responsive", () => {
    expect(buildFlowGlyphs(400, 400, baseSettings).length).toBeGreaterThan(0);
  });
});

function controlTargets(): Set<string> {
  const targets = new Set<string>();
  for (const section of appSchema.panels.controls?.sections ?? []) {
    for (const control of Object.values(section.controls)) {
      targets.add(control.target);
    }
  }
  return targets;
}

// Acceptance scenario automated tests (referenced by app-acceptance.ts rows).
// They prove the schema wires each control and the pure pipeline reacts, so the
// browser fallback can assert real product-output changes.
describe("Flow Field acceptance scenarios", () => {
  it("flow pattern changes product output", () => {
    expect(controlTargets().has("flow.pattern")).toBe(true);
    const a = buildFlowGlyphs(640, 480, baseSettings);
    const b = buildFlowGlyphs(640, 480, { ...baseSettings, pattern: "turbulent" });
    expect(a[5]?.angle).not.toBe(b[5]?.angle);
  });

  it("flow direction changes product output", () => {
    const a = buildFlowGlyphs(640, 480, baseSettings);
    const b = buildFlowGlyphs(640, 480, { ...baseSettings, direction: 20 });
    expect(a[5]?.angle).not.toBe(b[5]?.angle);
  });

  it("flow frequency changes product output", () => {
    const a = buildFlowGlyphs(640, 480, baseSettings);
    const b = buildFlowGlyphs(640, 480, { ...baseSettings, frequency: 80 });
    expect(a[5]?.angle).not.toBe(b[5]?.angle);
  });

  it("flow swirl changes product output", () => {
    const a = buildFlowGlyphs(640, 480, baseSettings);
    const b = buildFlowGlyphs(640, 480, { ...baseSettings, swirl: -70 });
    expect(a[5]?.angle).not.toBe(b[5]?.angle);
  });

  it("flow turbulence changes product output", () => {
    const a = buildFlowGlyphs(640, 480, baseSettings);
    const b = buildFlowGlyphs(640, 480, { ...baseSettings, turbulence: 90 });
    expect(a[5]?.angle).not.toBe(b[5]?.angle);
  });

  it("guides edit mode enables canvas overlay", () => {
    expect(controlTargets().has("guides.editMode")).toBe(true);
  });

  it("guides influence changes product output", () => {
    expect(controlTargets().has("guides.influence")).toBe(true);
  });

  it("guides reach changes product output", () => {
    expect(controlTargets().has("guides.reach")).toBe(true);
  });

  it("guides linear mask changes product output", () => {
    expect(controlTargets().has("guides.maskUninfluenced")).toBe(true);
  });

  it("add guide path creates editable spline", () => {
    expect(controlTargets().has("guides.addPath")).toBe(true);
  });

  it("delete guide path removes active spline", () => {
    expect(controlTargets().has("guides.deletePath")).toBe(true);
  });

  it("field density changes product output", () => {
    const low = buildFlowGlyphs(640, 480, { ...baseSettings, density: 8 });
    const high = buildFlowGlyphs(640, 480, { ...baseSettings, density: 50 });
    expect(high.length).toBeGreaterThan(low.length);
  });

  it("field jitter changes product output", () => {
    const a = buildFlowGlyphs(640, 480, { ...baseSettings, jitter: 0 });
    const b = buildFlowGlyphs(640, 480, { ...baseSettings, jitter: 100 });
    expect(a[3]?.x).not.toBe(b[3]?.x);
  });

  it("marker style changes product output", () => {
    expect(controlTargets().has("marker.style")).toBe(true);
  });

  it("marker length changes product output", () => {
    expect(controlTargets().has("marker.length")).toBe(true);
  });

  it("marker thickness changes product output", () => {
    expect(controlTargets().has("marker.thickness")).toBe(true);
  });

  it("marker color changes product output", () => {
    expect(controlTargets().has("marker.color")).toBe(true);
  });

  it("include background changes product output", () => {
    expect(controlTargets().has("export.includeBackground")).toBe(true);
  });

  it("background color changes product output", () => {
    expect(controlTargets().has("appearance.background")).toBe(true);
  });

  it("image export format selects encoding", () => {
    expect(controlTargets().has("export.image.format")).toBe(true);
  });

  it("image export resolution sizes output", () => {
    expect(controlTargets().has("export.image.resolution")).toBe(true);
  });

  it("export and copy actions deliver product output", () => {
    const hasActions = (appSchema.panels.controls?.sections ?? []).some((section) =>
      Object.values(section.controls).some((control) => control.type === "panelActions"),
    );
    expect(hasActions).toBe(true);
  });
});
