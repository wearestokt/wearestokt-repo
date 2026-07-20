import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { appPerformance } from "../src/app/app-performance";
import {
  applyToolcraftPerformanceStressFixture,
  applyToolcraftPerformanceWorkloadFixture,
  dragToolcraftSliderByLabel,
  dragToolcraftSliderToPerformanceStressValue,
  expectToolcraftCanvasBackingPixelsForRenderScale,
  expectToolcraftCanvasViewportStable,
  expectToolcraftScenarioPerformanceBudget,
  getToolcraftFieldByLabel,
  getToolcraftPerformanceStressValue,
  measureToolcraftInteraction,
  measureToolcraftScenario,
  setToolcraftSliderValue,
  zoomToolcraftCanvasViewport,
} from "./performance-helpers";

const yardCanvasSelector = "[data-toolcraft-product-canvas]";

async function writeGradientPng(page: Page, width: number, height: number): Promise<string> {
  const bytes = await page.evaluate(
    async ({ height, width }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas 2D is unavailable.");
      }
      const gradient = context.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, "#0a0a0a");
      gradient.addColorStop(1, "#f5f5f5");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => {
          if (value) {
            resolve(value);
            return;
          }
          reject(new Error("Failed to encode PNG."));
        }, "image/png");
      });
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    },
    { height, width },
  );
  const directory = mkdtempSync(join(tmpdir(), "yard-perf-source-"));
  const filePath = join(directory, "gradient.png");
  writeFileSync(filePath, Buffer.from(bytes));
  return filePath;
}

async function uploadSourceImage(page: Page, width: number, height: number): Promise<void> {
  const filePath = await writeGradientPng(page, width, height);
  const section = page
    .locator("section")
    .filter({ has: page.getByRole("button", { name: "Collapse App Mode section" }) })
    .first();
  await section.locator('input[type="file"]').setInputFiles(filePath);
  await expect(section.locator('[data-slot="file-upload-file-item"]').first()).toBeVisible();
}

async function enableASCII(page: Page): Promise<void> {
  await selectToolcraftOption(page, "App mode", "ASCII");
}

async function gotoYard(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator(yardCanvasSelector)).toBeVisible();
}

async function selectToolcraftOption(page: Page, label: string, optionName: string): Promise<void> {
  const field = await getToolcraftFieldByLabel(page, label);
  await field.getByRole("combobox").click();
  const option = page.getByRole("option", { name: optionName });
  if ((await option.count()) > 0) {
    await option.first().click();
    return;
  }
  await page.getByText(optionName, { exact: true }).click();
}

async function dragOffsetVector(page: Page): Promise<void> {
  const field = await getToolcraftFieldByLabel(page, "Offset");
  const pad = field.locator('[data-slot="vector-pad"]').first();
  await expect(pad).toBeVisible();
  const box = await pad.boundingBox();
  if (!box) {
    throw new Error("Offset vector pad is missing.");
  }
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.75);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25);
  await page.mouse.up();
}

async function setSectionColorHex(
  page: Page,
  sectionTitle: string,
  index: number,
  hex: string,
): Promise<void> {
  const section = page
    .locator("section")
    .filter({ has: page.getByRole("button", { name: `Collapse ${sectionTitle} section` }) })
    .first();
  const colorButton = section
    .locator('[data-slot="color-trigger"], button[aria-label*="color" i]')
    .nth(index);
  await colorButton.click();
  const hexInput = page.getByRole("textbox", { name: /hex/i }).first();
  await hexInput.fill(hex);
  await hexInput.press("Enter");
}

async function measureSliderDrag(
  page: Page,
  label: string,
  scenarioId: string,
): Promise<void> {
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderByLabel(page, label);
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, scenarioId);
}

async function measureSelectChange(
  page: Page,
  label: string,
  optionName: string,
  scenarioId: string,
): Promise<void> {
  const result = await measureToolcraftInteraction(page, async () => {
    await selectToolcraftOption(page, label, optionName);
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, scenarioId);
}

test("browser perf: preview render stays under budget", async ({ page }) => {
  const stressWidth = getToolcraftPerformanceStressValue<number>(appPerformance, "preview-render");
  const result = await measureToolcraftScenario(page, async () => {
    await page.goto("/");
    await setToolcraftSliderValue(page, "Width", stressWidth);
    await expect(page.locator(yardCanvasSelector)).toBeVisible();
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "preview-render");
});

test("browser perf: viewport stays stable", async ({ page }) => {
  await gotoYard(page);
  const result = await expectToolcraftCanvasViewportStable(page, async () => {
    await page.mouse.wheel(0, 240);
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "viewport-stability");
});

test("browser perf: viewport zoom stays stable under load", async ({ page }) => {
  await gotoYard(page);
  const stressWidth = getToolcraftPerformanceStressValue<number>(
    appPerformance,
    "viewport-zoom-stress",
  );
  await setToolcraftSliderValue(page, "Width", stressWidth);
  const result = await measureToolcraftInteraction(page, async () => {
    await zoomToolcraftCanvasViewport(page, 2);
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "viewport-zoom-stress");
});

test("browser perf: export png stays under budget", async ({ page }) => {
  await gotoYard(page);
  await selectToolcraftOption(page, "Format", "PNG");
  const result = await measureToolcraftScenario(page, async () => {
    await page.getByRole("button", { name: "Export PNG" }).click();
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "export-copy");
});

test("browser perf: stagger drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await measureSliderDrag(page, "Stagger", "yard-stagger-drag");
});

test("browser perf: rotation drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await measureSliderDrag(page, "Rotation", "yard-rotation-drag");
});

test("browser perf: container width drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await applyToolcraftPerformanceWorkloadFixture(page, appPerformance, "yard-width-drag", {
    "canvas.size": async (value, { page: activePage }) => {
      const size = value as { width: number; height: number };
      await setToolcraftSliderValue(activePage, "Canvas width", size.width);
      await setToolcraftSliderValue(activePage, "Canvas height", size.height);
    },
  });
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderToPerformanceStressValue(
      page,
      "Width",
      appPerformance,
      "yard-width-drag",
    );
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "yard-width-drag");
});

test("browser perf: orientation change stays responsive", async ({ page }) => {
  await gotoYard(page);
  await measureSelectChange(page, "Orientation", "Horizontal", "yard-orientation-change");
});

test("browser perf: layout change stays responsive", async ({ page }) => {
  await gotoYard(page);
  await measureSelectChange(page, "Stagger axis", "Columns", "yard-layout-change");
});

test("browser perf: layout type change stays responsive", async ({ page }) => {
  await gotoYard(page);
  await measureSelectChange(page, "App mode", "Radial", "yard-layout-type-change");
});

test("browser perf: radial align change stays responsive", async ({ page }) => {
  await gotoYard(page);
  await selectToolcraftOption(page, "App mode", "Radial");
  await measureSelectChange(page, "Ring align", "Radial", "yard-radial-align-change");
});

test("browser perf: source image import stays responsive", async ({ page }) => {
  await gotoYard(page);
  await selectToolcraftOption(page, "App mode", "ASCII");
  const dimensions = getToolcraftPerformanceStressValue<{ height: number; width: number }>(
    appPerformance,
    "media-source-image-import",
  );
  const result = await measureToolcraftInteraction(page, async () => {
    await uploadSourceImage(page, dimensions.width, dimensions.height);
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "media-source-image-import");
});

test("browser perf: dither app mode change stays responsive", async ({ page }) => {
  await gotoYard(page);
  await selectToolcraftOption(page, "App mode", "ASCII");
  await uploadSourceImage(page, 1920, 1080);
  const result = await measureToolcraftInteraction(page, async () => {
    await selectToolcraftOption(page, "App mode", "Rectangular");
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "yard-dither-enabled-change");
});

test("browser perf: dither algorithm change stays responsive", async ({ page }) => {
  await gotoYard(page);
  await enableASCII(page);
  await uploadSourceImage(page, 1920, 1080);
  await measureSelectChange(page, "Style", "Mono", "yard-dither-algorithm-change");
});

test("browser perf: dither strength drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await applyToolcraftPerformanceWorkloadFixture(page, appPerformance, "yard-dither-strength-drag", {
    "canvas.size": async (value) => {
      const size = value as { height: number; width: number };
      await setToolcraftSliderValue(page, "Canvas width", size.width);
      await setToolcraftSliderValue(page, "Canvas height", size.height);
    },
  });
  await enableASCII(page);
  await uploadSourceImage(page, 1920, 1080);
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderToPerformanceStressValue(
      page,
      "Image Mix",
      appPerformance,
      "yard-dither-strength-drag",
    );
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "yard-dither-strength-drag");
});

test("browser perf: dither contrast drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await enableASCII(page);
  await uploadSourceImage(page, 1920, 1080);
  await measureSliderDrag(page, "Image Contrast", "yard-dither-contrast-drag");
});

test("browser perf: matte style change stays responsive", async ({ page }) => {
  await gotoYard(page);
  await enableASCII(page);
  await uploadSourceImage(page, 1920, 1080);
  await measureSelectChange(page, "Subject matte", "Auto", "yard-matte-style-change");
});

test("browser perf: matte min coverage drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await enableASCII(page);
  await uploadSourceImage(page, 1920, 1080);
  await measureSliderDrag(page, "Min coverage", "yard-matte-min-coverage-drag");
});

test("browser perf: length short drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await measureSliderDrag(page, "Length short", "yard-length-short-drag");
});

test("browser perf: length long drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await measureSliderDrag(page, "Length long", "yard-length-long-drag");
});

test("browser perf: length mix drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await measureSliderDrag(page, "Long mix", "yard-length-mix-drag");
});

test("browser perf: column gap drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await measureSliderDrag(page, "Column gap", "yard-column-gap-drag");
});

test("browser perf: row gap drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await measureSliderDrag(page, "Row gap", "yard-row-gap-drag");
});

test("browser perf: gaps drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await measureSliderDrag(page, "Gaps", "yard-random-gaps-drag");
});

test("browser perf: offset drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  const result = await measureToolcraftInteraction(page, async () => {
    await dragOffsetVector(page);
  });
  await expect(page.locator('[data-slot="vector-pad"]').first()).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "yard-offset-drag");
});

test("browser perf: global scale drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await measureSliderDrag(page, "Global scale", "yard-global-scale-drag");
});

test("browser perf: color count drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await measureSliderDrag(page, "Colors", "yard-color-count-drag");
});

test("browser perf: shuffle action stays responsive", async ({ page }) => {
  await gotoYard(page);
  const result = await measureToolcraftInteraction(page, async () => {
    await page.getByRole("button", { name: "Shuffle" }).click();
  });
  await expect(page.locator(yardCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "yard-shuffle-action");
});

test("browser perf: palette color 1 change stays responsive", async ({ page }) => {
  await gotoYard(page);
  const result = await measureToolcraftInteraction(page, async () => {
    await setSectionColorHex(page, "Container Colors", 0, "#00FFAA");
  });
  await expect(page.locator(yardCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "yard-color1-change");
});

test("browser perf: palette color 2 change stays responsive", async ({ page }) => {
  await gotoYard(page);
  const result = await measureToolcraftInteraction(page, async () => {
    await setSectionColorHex(page, "Container Colors", 1, "#AA00FF");
  });
  await expect(page.locator(yardCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "yard-color2-change");
});

test("browser perf: palette color 3 change stays responsive", async ({ page }) => {
  await gotoYard(page);
  await setToolcraftSliderValue(page, "Colors", 6);
  const result = await measureToolcraftInteraction(page, async () => {
    await setSectionColorHex(page, "Container Colors", 2, "#FFAA00");
  });
  await expect(page.locator(yardCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "yard-color3-change");
});

test("browser perf: palette color 4 change stays responsive", async ({ page }) => {
  await gotoYard(page);
  await setToolcraftSliderValue(page, "Colors", 6);
  const result = await measureToolcraftInteraction(page, async () => {
    await setSectionColorHex(page, "Container Colors", 3, "#00AAFF");
  });
  await expect(page.locator(yardCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "yard-color4-change");
});

test("browser perf: palette color 5 change stays responsive", async ({ page }) => {
  await gotoYard(page);
  await setToolcraftSliderValue(page, "Colors", 6);
  const result = await measureToolcraftInteraction(page, async () => {
    await setSectionColorHex(page, "Container Colors", 4, "#FF0055");
  });
  await expect(page.locator(yardCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "yard-color5-change");
});

test("browser perf: palette color 6 change stays responsive", async ({ page }) => {
  await gotoYard(page);
  await setToolcraftSliderValue(page, "Colors", 6);
  const result = await measureToolcraftInteraction(page, async () => {
    await setSectionColorHex(page, "Container Colors", 5, "#55FF00");
  });
  await expect(page.locator(yardCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "yard-color6-change");
});

test("browser perf: palette color 7 change stays responsive", async ({ page }) => {
  await gotoYard(page);
  await setToolcraftSliderValue(page, "Colors", 7);
  const result = await measureToolcraftInteraction(page, async () => {
    await setSectionColorHex(page, "Container Colors", 6, "#5500FF");
  });
  await expect(page.locator(yardCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "yard-color7-change");
});

test("browser perf: palette color 8 change stays responsive", async ({ page }) => {
  await gotoYard(page);
  await setToolcraftSliderValue(page, "Colors", 8);
  const result = await measureToolcraftInteraction(page, async () => {
    await setSectionColorHex(page, "Container Colors", 7, "#FFFF00");
  });
  await expect(page.locator(yardCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "yard-color8-change");
});

test("browser perf: shadow toggle stays responsive", async ({ page }) => {
  await gotoYard(page);
  const result = await measureToolcraftInteraction(page, async () => {
    const field = await getToolcraftFieldByLabel(page, "Shadow");
    await field.getByRole("switch").click();
  });
  await expect(page.locator(yardCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "yard-shadow-enabled-change");
});

test("browser perf: shadow opacity drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await measureSliderDrag(page, "Shadow opacity", "yard-shadow-opacity-drag");
});

test("browser perf: shadow x drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await measureSliderDrag(page, "Shadow X", "yard-shadow-offset-x-drag");
});

test("browser perf: shadow y drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await measureSliderDrag(page, "Shadow Y", "yard-shadow-offset-y-drag");
});

test("browser perf: include background change stays responsive", async ({ page }) => {
  await gotoYard(page);
  const result = await measureToolcraftInteraction(page, async () => {
    const field = await getToolcraftFieldByLabel(page, "Include");
    await field.getByRole("switch").click();
  });
  await expect(page.locator(yardCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "export-include-background-change");
});

test("browser perf: background color change stays responsive", async ({ page }) => {
  await gotoYard(page);
  const result = await measureToolcraftInteraction(page, async () => {
    await setSectionColorHex(page, "Background", 0, "#112233");
  });
  await expect(page.locator(yardCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "appearance-background-change");
});

test("browser perf: image format change stays responsive", async ({ page }) => {
  await gotoYard(page);
  await measureSelectChange(page, "Format", "JPG", "export-image-format-change");
});

test("browser perf: image resolution change stays responsive", async ({ page }) => {
  await gotoYard(page);
  await applyToolcraftPerformanceWorkloadFixture(page, appPerformance, "export-image-resolution-change", {
    "canvas.size": async (value, { page: activePage }) => {
      const size = value as { width: number; height: number };
      await setToolcraftSliderValue(activePage, "Canvas width", size.width);
      await setToolcraftSliderValue(activePage, "Canvas height", size.height);
    },
  });
  const result = await measureToolcraftInteraction(page, async () => {
    await applyToolcraftPerformanceStressFixture(page, appPerformance, "export-image-resolution-change", {
      heavyExportPreset: async (value, { page: activePage }) => {
        await selectToolcraftOption(activePage, "Preset", String(value).toUpperCase());
      },
    });
  });
  await expect(page.locator(yardCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "export-image-resolution-change");
});

test("browser perf: contain toggle stays responsive", async ({ page }) => {
  await gotoYard(page);
  const result = await measureToolcraftInteraction(page, async () => {
    const field = await getToolcraftFieldByLabel(page, "Contain");
    await field.getByRole("switch").click();
  });
  await expect(page.locator(yardCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "yard-contain-change");
});

test("browser perf: color mode change stays responsive", async ({ page }) => {
  await gotoYard(page);
  const result = await measureToolcraftInteraction(page, async () => {
    await selectToolcraftOption(page, "Color mode", "Wave");
  });
  await expect(page.locator(yardCanvasSelector)).toBeVisible();
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "yard-color-mode-change");
});

test("browser perf: wave cycles drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await selectToolcraftOption(page, "Color mode", "Wave");
  await measureSliderDrag(page, "Wave cycles", "yard-wave-cycles-drag");
});

test("browser perf: pattern step drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await selectToolcraftOption(page, "Color mode", "Checker");
  await measureSliderDrag(page, "Pattern step", "yard-color-pattern-step-drag");
});

test("browser perf: wave axis change stays responsive", async ({ page }) => {
  await gotoYard(page);
  await selectToolcraftOption(page, "Color mode", "Wave");
  await measureSelectChange(page, "Wave axis", "Radial", "yard-wave-axis-change");
});

test("browser perf: zone axis change stays responsive", async ({ page }) => {
  await gotoYard(page);
  await selectToolcraftOption(page, "Color mode", "Zones");
  await measureSelectChange(page, "Zone axis", "Vertical", "yard-zone-axis-change");
});

test("browser perf: zone count change stays responsive", async ({ page }) => {
  await gotoYard(page);
  await selectToolcraftOption(page, "Color mode", "Zones");
  const field = await getToolcraftFieldByLabel(page, "Zone count");
  await field.getByRole("combobox").click();
  await page.getByRole("option", { name: "3 zones" }).click();
  const result = await measureToolcraftInteraction(page, async () => {
    await field.getByRole("combobox").click();
    await page.getByRole("option", { name: "4 zones" }).click();
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "yard-zone-count-change");
});

test("browser perf: zone 1 slot drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await selectToolcraftOption(page, "Color mode", "Zones");
  await measureSliderDrag(page, "Zone 1", "yard-zone1-slot-drag");
});

test("browser perf: zone 2 slot drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await selectToolcraftOption(page, "Color mode", "Zones");
  await measureSliderDrag(page, "Zone 2", "yard-zone2-slot-drag");
});

test("browser perf: zone 3 slot drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await selectToolcraftOption(page, "Color mode", "Zones");
  const field = await getToolcraftFieldByLabel(page, "Zone count");
  await field.getByRole("combobox").click();
  await page.getByRole("option", { name: "3 zones" }).click();
  await measureSliderDrag(page, "Zone 3", "yard-zone3-slot-drag");
});

test("browser perf: zone 4 slot drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await selectToolcraftOption(page, "Color mode", "Zones");
  const field = await getToolcraftFieldByLabel(page, "Zone count");
  await field.getByRole("combobox").click();
  await page.getByRole("option", { name: "4 zones" }).click();
  await measureSliderDrag(page, "Zone 4", "yard-zone4-slot-drag");
});

test("browser perf: stripe orientation change stays responsive", async ({ page }) => {
  await gotoYard(page);
  await selectToolcraftOption(page, "Color mode", "Stripes");
  const section = page
    .locator("section")
    .filter({ has: page.getByRole("button", { name: "Collapse Highlight Stripes section" }) })
    .first();
  const field = section.locator('[data-slot="field"], [role="group"]').filter({ hasText: /^Stripe axis/ }).first();
  await field.getByRole("combobox").click();
  const result = await measureToolcraftInteraction(page, async () => {
    await page.getByRole("option", { name: "Horizontal" }).click();
  });
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "yard-stripe-orientation-change");
});

test("browser perf: stripe repeat drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await selectToolcraftOption(page, "Color mode", "Stripes");
  await measureSliderDrag(page, "Stripe count", "yard-stripe-repeat-drag");
});

test("browser perf: stripe width drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await selectToolcraftOption(page, "Color mode", "Stripes");
  await measureSliderDrag(page, "Stripe width", "yard-stripe-width-drag");
});

test("browser perf: stripe color slot drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await selectToolcraftOption(page, "Color mode", "Stripes");
  await measureSliderDrag(page, "Highlight", "yard-stripe-color-slot-drag");
});

test("browser perf: seed drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  await measureSliderDrag(page, "Seed", "yard-seed-drag");
});

test("browser perf: render scale drag stays responsive", async ({ page }) => {
  await gotoYard(page);
  const result = await measureToolcraftInteraction(page, async () => {
    await dragToolcraftSliderByLabel(page, "Resolution scale");
  });
  await expectToolcraftCanvasBackingPixelsForRenderScale(page, yardCanvasSelector, 2);
  expectToolcraftScenarioPerformanceBudget(result, appPerformance, "canvas-render-scale-drag");
});
