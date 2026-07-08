import { expect, test, type Page } from "@playwright/test";

import { appPerformance } from "../src/app/app-performance";
import {
  applyToolcraftPerformanceStressFixture,
  applyToolcraftPerformanceWorkloadFixture,
  dragToolcraftCanvasViewport,
  dragToolcraftSliderByLabel,
  dragToolcraftSliderToPerformanceStressValue,
  dragToolcraftSliderToValue,
  expectToolcraftCanvasViewportStable,
  expectToolcraftScenarioPerformanceBudget,
  getToolcraftFieldByLabel,
  getToolcraftPerformanceStressValue,
  getToolcraftPerformanceWorkloadValue,
  measureToolcraftInteraction,
  zoomToolcraftCanvasViewport,
} from "./performance-helpers";

const flowCanvasSelector = "[data-toolcraft-flow-canvas]";

async function changeSelectOption(
  page: Page,
  label: string,
  optionName: string,
): Promise<void> {
  const field = await getToolcraftFieldByLabel(page, label);
  await field.getByRole("combobox").click();
  const option = page
    .locator('[data-slot="select-content"] [role="option"]')
    .filter({ hasText: optionName })
    .first();
  await expect(option, `Select option "${optionName}" should be visible`).toBeVisible();
  await option.click();
}

async function setNumberFieldByLabel(
  page: Page,
  label: string,
  value: number,
): Promise<void> {
  const field = await getToolcraftFieldByLabel(page, label);
  const input = field.locator('input[type="number"], input[inputmode="numeric"], input').first();
  await input.fill(String(value));
  await input.press("Enter");
}

async function applyCanvasSizeWorkload(
  page: Page,
  value: { height: number; width: number },
): Promise<void> {
  await setNumberFieldByLabel(page, "Canvas width", value.width);
  await setNumberFieldByLabel(page, "Canvas height", value.height);
}

async function seedPath(page: Page): Promise<void> {
  await page.evaluate(() => window.__toolcraftSeedFlowPath?.());
}

test("browser perf: preview render stays under budget", async ({ page }) => {
  await page.goto("/");
  const density = getToolcraftPerformanceStressValue<number>(appPerformance, "preview-render");
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderToValue(page, "Density", density);
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "preview-render");
});

test("browser perf: viewport stays stable", async ({ page }) => {
  await page.goto("/");
  const result = await expectToolcraftCanvasViewportStable(page, async () => {
    await dragToolcraftCanvasViewport(page, { x: 90, y: -60 });
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "viewport-stability");
});

test("browser perf: viewport zoom stays stable under load", async ({ page }) => {
  await page.goto("/");
  const density = getToolcraftPerformanceStressValue<number>(
    appPerformance,
    "viewport-zoom-stress",
  );
  await dragToolcraftSliderToValue(page, "Density", density);
  const result = await measureToolcraftInteraction(page, async () => {
    await zoomToolcraftCanvasViewport(page, 3);
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "viewport-zoom-stress");
});

test("browser perf: export png stays under budget", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export SVG" }).click(),
    ]);
  });
  await expect(page.getByRole("button", { name: "Export SVG" })).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "export-copy");
});

test("browser perf: pattern change stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await changeSelectOption(page, "Pattern", "Vortex");
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "flow-pattern-change");
});

test("browser perf: direction drag stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderByLabel(page, "Direction", 0.85);
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "flow-direction-drag");
});

test("browser perf: scale drag stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderByLabel(page, "Scale", 0.85);
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "flow-scale-drag");
});

test("browser perf: swirl drag stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderByLabel(page, "Swirl", 0.9);
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "flow-swirl-drag");
});

test("browser perf: turbulence drag stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderByLabel(page, "Turbulence", 0.9);
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "flow-turbulence-drag");
});

test("browser perf: density drag stays responsive", async ({ page }) => {
  await page.goto("/");
  const workload = getToolcraftPerformanceWorkloadValue<{ height: number; width: number }>(
    appPerformance,
    "streams-density-drag",
  );
  await applyCanvasSizeWorkload(page, workload);
  await dragToolcraftSliderByLabel(page, "Density", 0.3);
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderToPerformanceStressValue(
      page,
      "Density",
      appPerformance,
      "streams-density-drag",
    );
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "streams-density-drag");
});

test("browser perf: smoothness drag stays responsive", async ({ page }) => {
  await page.goto("/");
  const workload = getToolcraftPerformanceWorkloadValue<{ height: number; width: number }>(
    appPerformance,
    "streams-smoothness-drag",
  );
  await applyCanvasSizeWorkload(page, workload);
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderToPerformanceStressValue(
      page,
      "Smoothness",
      appPerformance,
      "streams-smoothness-drag",
    );
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "streams-smoothness-drag");
});

test("browser perf: marker style change stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await changeSelectOption(page, "Style", "Arrow");
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "stroke-style-change");
});

test("browser perf: marker length drag stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderByLabel(page, "Length max", 0.95);
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "streams-length-max-drag");
});

test("browser perf: marker thickness drag stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderByLabel(page, "Width", 0.95);
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "stroke-width-drag");
});

test("browser perf: palette change stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await changeSelectOption(page, "Palette", "Ember");
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "color-palette-change");
});

test("browser perf: custom palette color change stays responsive", async ({ page }) => {
  await page.goto("/");
  await changeSelectOption(page, "Palette", "Custom");
  const field = await getToolcraftFieldByLabel(page, "Color 1");
  const result = await measureToolcraftInteraction(page, async () => {
    const hexInput = field.locator('input[aria-label*="hex" i], input[type="text"]').first();
    await hexInput.fill("#22DD88");
    await hexInput.press("Enter");
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "color-custom-change");
});

test("browser perf: include background change stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    const field = await getToolcraftFieldByLabel(page, "Include");
    await field.getByRole("switch").click();
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "include-background-change");
});

test("browser perf: background color change stays responsive", async ({ page }) => {
  await page.goto("/");
  const field = page.locator('[data-slot="field"]').filter({ hasText: "Include" }).first();
  const result = await measureToolcraftInteraction(page, async () => {
    const hexInput = field.locator('input[aria-label*="hex" i], input[type="text"]').first();
    await hexInput.fill("#0A1622");
    await hexInput.press("Enter");
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "background-color-change");
});

test("browser perf: image format change stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await changeSelectOption(page, "Format", "JPG");
  });
  await expect(page.getByRole("button", { name: "Export JPG" })).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "image-format-change");
});

test("browser perf: image resolution change stays responsive", async ({ page }) => {
  await page.goto("/");
  const workload = getToolcraftPerformanceWorkloadValue<{ height: number; width: number }>(
    appPerformance,
    "image-resolution-change",
  );
  await applyCanvasSizeWorkload(page, workload);
  await applyToolcraftPerformanceStressFixture(
    page,
    appPerformance,
    "image-resolution-change",
    {
      resolution: async (value) => {
        await changeSelectOption(page, "Preset", String(value).toUpperCase());
      },
    },
  );
  const result = await measureToolcraftInteraction(page, async () => {
    await changeSelectOption(page, "Preset", "4K");
  });
  await expect(page.getByRole("button", { name: "Export SVG" })).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "image-resolution-change");
});

test("browser perf: paths strength drag stays responsive", async ({ page }) => {
  await page.goto("/");
  await seedPath(page);
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderByLabel(page, "Strength", 0.2);
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "paths-strength-drag");
});

test("browser perf: paths reach drag stays responsive", async ({ page }) => {
  await page.goto("/");
  await seedPath(page);
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderByLabel(page, "Reach", 0.95);
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "paths-reach-drag");
});

test("browser perf: paths edit mode change stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    const field = await getToolcraftFieldByLabel(page, "Edit paths");
    await field.getByRole("switch").click();
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "paths-edit-mode-change");
});

test("browser perf: add path stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await page.getByRole("button", { name: "Add path" }).click();
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "paths-add-path-change");
});

test("browser perf: delete path stays responsive", async ({ page }) => {
  await page.goto("/");
  await seedPath(page);
  const result = await measureToolcraftInteraction(page, async () => {
    await page.getByRole("button", { name: "Delete path" }).click();
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "paths-delete-path-change");
});

test("browser perf: streams length contrast drag stays responsive", async ({ page }) => {
  await page.goto("/");
  const workload = getToolcraftPerformanceWorkloadValue<{ height: number; width: number }>(
    appPerformance,
    "streams-length-contrast-drag",
  );
  await applyCanvasSizeWorkload(page, workload);
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderToPerformanceStressValue(
      page,
      "Length contrast",
      appPerformance,
      "streams-length-contrast-drag",
    );
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "streams-length-contrast-drag");
});

test("browser perf: export svg stays under budget", async ({ page }) => {
  await page.goto("/");
  const density = getToolcraftPerformanceStressValue<number>(appPerformance, "export-svg");
  await dragToolcraftSliderToPerformanceStressValue(page, "Density", appPerformance, "export-svg");
  await changeSelectOption(page, "Format", "SVG");
  const result = await measureToolcraftInteraction(page, async () => {
    await page.getByRole("button", { name: "Export SVG" }).click();
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "export-svg");
});

test("browser perf: stroke taper change stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await changeSelectOption(page, "Taper", "Both");
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "stroke-taper-change");
});

test("browser perf: stroke head size drag stays responsive", async ({ page }) => {
  await page.goto("/");
  await changeSelectOption(page, "Style", "Arrow");
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderByLabel(page, "Arrow head", 0.95);
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "stroke-head-size-drag");
});

test("browser perf: color assignment change stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await changeSelectOption(page, "Assignment", "By speed");
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "color-assignment-change");
});

test("browser perf: packed xl size variety stays responsive", async ({ page }) => {
  await page.goto("/");
  const workload = getToolcraftPerformanceWorkloadValue<{ height: number; width: number }>(
    appPerformance,
    "packed-xl-size-variety",
  );
  await applyCanvasSizeWorkload(page, workload);
  await changeSelectOption(page, "Spacing mode", "Packed");
  await dragToolcraftSliderToPerformanceStressValue(page, "Density", appPerformance, "preview-render");
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderToPerformanceStressValue(
      page,
      "Size variety",
      appPerformance,
      "packed-xl-size-variety",
    );
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "packed-xl-size-variety");
});

test("browser perf: field preset change stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await changeSelectOption(page, "Preset", "Storm");
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "flow-texture-preset-change");
});

test("browser perf: seed drag stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderByLabel(page, "Seed", 0.9);
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "flow-seed-drag");
});

test("browser perf: randomize seed stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await page.getByRole("button", { name: "Randomize" }).click();
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "flow-randomize-seed-change");
});

test("browser perf: streams length min drag stays responsive", async ({ page }) => {
  await page.goto("/");
  const workload = getToolcraftPerformanceWorkloadValue<{ height: number; width: number }>(
    appPerformance,
    "streams-length-min-drag",
  );
  await applyCanvasSizeWorkload(page, workload);
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderToPerformanceStressValue(
      page,
      "Length min",
      appPerformance,
      "streams-length-min-drag",
    );
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "streams-length-min-drag");
});

test("browser perf: stroke width by speed drag stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderByLabel(page, "Width by speed", 0.95);
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "stroke-width-by-speed-drag");
});

test("browser perf: snap angles change stays responsive", async ({ page }) => {
  await page.goto("/");
  const workload = getToolcraftPerformanceWorkloadValue<{ height: number; width: number }>(
    appPerformance,
    "flow-snap-angles-change",
  );
  await applyCanvasSizeWorkload(page, workload);
  const result = await measureToolcraftInteraction(page, async () => {
    await changeSelectOption(page, "Snap angles", "90°");
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "flow-snap-angles-change");
});

test("browser perf: shuffle stays responsive", async ({ page }) => {
  await page.goto("/");
  const workload = getToolcraftPerformanceWorkloadValue<{ height: number; width: number }>(
    appPerformance,
    "flow-shuffle-change",
  );
  await applyCanvasSizeWorkload(page, workload);
  const result = await measureToolcraftInteraction(page, async () => {
    await page.getByRole("button", { name: "Shuffle" }).click();
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "flow-shuffle-change");
});

test("browser perf: spacing mode change stays responsive", async ({ page }) => {
  await page.goto("/");
  const workload = getToolcraftPerformanceWorkloadValue<{ height: number; width: number }>(
    appPerformance,
    "streams-spacing-mode-change",
  );
  await applyCanvasSizeWorkload(page, workload);
  const result = await measureToolcraftInteraction(page, async () => {
    await changeSelectOption(page, "Spacing mode", "Packed");
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "streams-spacing-mode-change");
});

test("browser perf: gap drag stays responsive", async ({ page }) => {
  await page.goto("/");
  await applyToolcraftPerformanceWorkloadFixture(page, appPerformance, "streams-gap-drag", {
    gap: async (value) => {
      await dragToolcraftSliderToValue(page, "Gap", Number(value));
    },
    spacingMode: async (value) => {
      const label = value === "packed" ? "Packed" : value === "loose" ? "Loose" : "Even";
      await changeSelectOption(page, "Spacing mode", label);
    },
  });
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderToPerformanceStressValue(
      page,
      "Gap",
      appPerformance,
      "streams-gap-drag",
    );
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "streams-gap-drag");
});

test("browser perf: margin drag stays responsive", async ({ page }) => {
  await page.goto("/");
  const workload = getToolcraftPerformanceWorkloadValue<{ height: number; width: number }>(
    appPerformance,
    "streams-margin-drag",
  );
  await applyCanvasSizeWorkload(page, workload);
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderToPerformanceStressValue(
      page,
      "Margin",
      appPerformance,
      "streams-margin-drag",
    );
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "streams-margin-drag");
});

test("browser perf: stream opacity drag stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderByLabel(page, "Stream opacity", 0.2);
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "color-opacity-drag");
});

async function changeCustomPaletteSlot(
  page: Page,
  slotLabel: string,
  hex: string,
): Promise<void> {
  await changeSelectOption(page, "Palette", "Custom");
  const field = await getToolcraftFieldByLabel(page, slotLabel);
  const hexInput = field.locator('input[aria-label*="hex" i], input[type="text"]').first();
  await hexInput.fill(hex);
  await hexInput.press("Enter");
}

test("browser perf: custom palette slot 2 change stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await changeCustomPaletteSlot(page, "Color 2", "#22DD88");
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "color-custom2-change");
});

test("browser perf: custom palette slot 3 change stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await changeCustomPaletteSlot(page, "Color 3", "#22DD88");
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "color-custom3-change");
});

test("browser perf: custom palette slot 4 change stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await changeCustomPaletteSlot(page, "Color 4", "#22DD88");
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "color-custom4-change");
});

test("browser perf: custom palette slot 5 change stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await changeCustomPaletteSlot(page, "Color 5", "#22DD88");
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "color-custom5-change");
});
