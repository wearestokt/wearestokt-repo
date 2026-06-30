import { expect, test, type Page } from "@playwright/test";

import { appPerformance } from "../src/app/app-performance";
import {
  applyToolcraftPerformanceStressFixture,
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
  await field
    .locator('[data-slot="select-trigger"], [role="combobox"], button')
    .first()
    .click();
  await page.getByRole("option", { name: optionName }).first().click();
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
      page.getByRole("button", { name: "Export PNG" }).click(),
    ]);
  });
  await expect(page.getByRole("button", { name: "Export PNG" })).toBeVisible();
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

test("browser perf: frequency drag stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderByLabel(page, "Frequency", 0.85);
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "flow-frequency-drag");
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
    "field-density-drag",
  );
  await applyCanvasSizeWorkload(page, workload);
  await dragToolcraftSliderByLabel(page, "Density", 0.3);
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderToPerformanceStressValue(
      page,
      "Density",
      appPerformance,
      "field-density-drag",
    );
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "field-density-drag");
});

test("browser perf: jitter drag stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderByLabel(page, "Jitter", 0.95);
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "field-jitter-drag");
});

test("browser perf: marker style change stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await changeSelectOption(page, "Style", "Arrow");
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "marker-style-change");
});

test("browser perf: marker length drag stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderByLabel(page, "Length", 0.95);
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "marker-length-drag");
});

test("browser perf: marker thickness drag stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderByLabel(page, "Thickness", 0.95);
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "marker-thickness-drag");
});

test("browser perf: marker color change stays responsive", async ({ page }) => {
  await page.goto("/");
  const field = await getToolcraftFieldByLabel(page, "Color");
  const result = await measureToolcraftInteraction(page, async () => {
    await field
      .locator('[data-slot="select-trigger"], [role="combobox"], button')
      .first()
      .click();
    const hexInput = page.locator('input[type="text"], input[placeholder*="hex" i]').first();
    await hexInput.fill("#22DD88");
    await hexInput.press("Enter");
    await page.keyboard.press("Escape");
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "marker-color-change");
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
    await field.locator("button").last().click();
    const hexInput = page.locator('input[type="text"], input[placeholder*="hex" i]').first();
    await hexInput.fill("#0A1622");
    await hexInput.press("Enter");
    await page.keyboard.press("Escape");
  });
  await expect(page.locator(flowCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "background-color-change");
});

test("browser perf: image format change stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await changeSelectOption(page, "Format", "JPG");
  });
  await expect(page.getByRole("button", { name: "Export PNG" })).toBeVisible();
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
        await changeSelectOption(page, "Resolution", String(value).toUpperCase());
      },
    },
  );
  const result = await measureToolcraftInteraction(page, async () => {
    await changeSelectOption(page, "Resolution", "4K");
  });
  await expect(page.getByRole("button", { name: "Export PNG" })).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "image-resolution-change");
});

const productOutputSelector = "[data-toolcraft-product-output]";

async function seedHorizontalGuide(page: Page): Promise<void> {
  const editField = await getToolcraftFieldByLabel(page, "Edit guides");
  await editField.getByRole("switch").click();
  const output = page.locator(productOutputSelector).first();
  const box = await output.boundingBox();
  if (!box) {
    throw new Error("Flow field product output region was not found.");
  }
  await page.mouse.click(box.x + box.width * 0.15, box.y + box.height * 0.5);
  await page.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.5);
  await editField.getByRole("switch").click();
}

test("browser perf: guides influence drag stays responsive", async ({ page }) => {
  await page.goto("/");
  await seedHorizontalGuide(page);
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderByLabel(page, "Influence", 0.2);
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "guides-influence-drag");
});

test("browser perf: guides reach drag stays responsive", async ({ page }) => {
  await page.goto("/");
  await seedHorizontalGuide(page);
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderByLabel(page, "Reach", 0.95);
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "guides-reach-drag");
});

test("browser perf: guides linear mask toggle stays responsive", async ({ page }) => {
  await page.goto("/");
  await seedHorizontalGuide(page);
  const result = await measureToolcraftInteraction(page, async () => {
    const field = await getToolcraftFieldByLabel(page, "Linear only");
    await field.getByRole("switch").click();
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "guides-mask-toggle");
});

test("browser perf: export svg stays under budget", async ({ page }) => {
  await page.goto("/");
  const density = getToolcraftPerformanceStressValue<number>(appPerformance, "export-svg");
  await dragToolcraftSliderToPerformanceStressValue(page, "Density", density);
  await changeSelectOption(page, "Format", "SVG");
  const result = await measureToolcraftInteraction(page, async () => {
    await page.getByRole("button", { name: "Export PNG" }).click();
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "export-svg");
});

test("browser perf: guides edit mode change stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    const field = await getToolcraftFieldByLabel(page, "Edit guides");
    await field.getByRole("switch").click();
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "guides-edit-mode-change");
});

test("browser perf: add guide path stays responsive", async ({ page }) => {
  await page.goto("/");
  const result = await measureToolcraftInteraction(page, async () => {
    await page.getByRole("button", { name: "Add path" }).click();
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "guides-add-path-change");
});

test("browser perf: delete guide path stays responsive", async ({ page }) => {
  await page.goto("/");
  await seedHorizontalGuide(page);
  const result = await measureToolcraftInteraction(page, async () => {
    await page.getByRole("button", { name: "Delete path" }).click();
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "guides-delete-path-change");
});
