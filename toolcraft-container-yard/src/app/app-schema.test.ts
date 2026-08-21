import { describe, expect, it } from "vitest";

import { appPerformance } from "./app-performance";
import { appSchema } from "./app-schema";

describe("appSchema", () => {
  it("publishes the Container Yard product contract", () => {
    expect(appSchema.canvas.draggable).toBe(true);
    expect(appSchema.canvas.enabled).toBe(true);
    expect(appSchema.canvas.sizing).toEqual({ mode: "editable-output" });
    expect(appSchema.canvas.upload).toBe(true);
    expect(appSchema.panels.controls?.sections[0]?.title).toBe("Setup");
    expect(appSchema.panels.timeline).toMatchObject({
      defaultDurationSeconds: 4,
      enabled: true,
      mode: "keyframes",
    });
    expect(appSchema.panels.layers).toBeUndefined();
    expect(appSchema.toolbar).toEqual({
      history: true,
      radar: true,
      theme: true,
      zoom: true,
    });
    expect(appSchema.assembly.capabilities).toEqual(
      expect.arrayContaining([
        "timeline.keyframes",
        "timeline.playback",
        "canvas.upload",
        "controls.panel",
      ]),
    );
    expect(appSchema.assembly.commands).toEqual(
      expect.arrayContaining([
        "timeline.setCurrentTime",
        "timeline.toggleControlKeyframes",
        "media.import",
      ]),
    );
  });

  it("exposes product sections after Setup including unified Export Settings", () => {
    const productTitles =
      appSchema.panels.controls?.sections
        .filter((section) => section.title !== "Setup")
        .map((section) => section.title) ?? [];

    expect(productTitles).toEqual(
      expect.arrayContaining([
        "App Mode",
        "Source",
        "Grid Layout",
        "Export Settings",
        "Export",
      ]),
    );
    expect(productTitles).not.toEqual(expect.arrayContaining(["Mask Shape", "Depth", "Image Export", "Video Export"]));
    const exportIndex = productTitles.indexOf("Export Settings");
    const actionsIndex = productTitles.indexOf("Export");
    expect(actionsIndex).toBe(exportIndex + 1);
  });

  it("enables keyframe timeline for layout animation and video export", () => {
    expect(appSchema.assembly.capabilities).toContain("timeline.keyframes");
    expect(appSchema.assembly.commands).toContain("timeline.moveKeyframe");
  });

  it("declares custom-renderer performance workload targets", () => {
    expect(appPerformance.usesCustomRenderer).toBe(true);
    expect(appPerformance.scenarios.length).toBeGreaterThan(0);
    expect(appPerformance.workloadTargets.length).toBeGreaterThan(0);
  });
});
