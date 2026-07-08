import { readFileSync } from "node:fs";

import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  getToolcraftFieldByLabel,
  setToolcraftSliderValue,
} from "./performance-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";

const flowCanvasSelector = "[data-toolcraft-flow-canvas]";
const productOutputSelector = "[data-toolcraft-product-output]";

async function seedPath(page: Page): Promise<void> {
  await page.evaluate(() => window.__toolcraftSeedFlowPath?.());
}

async function getSectionFieldByLabel(
  page: Page,
  sectionTitle: string,
  label: string,
): Promise<Locator> {
  const section = page
    .locator("section")
    .filter({ has: page.getByRole("button", { name: `Collapse ${sectionTitle} section` }) })
    .first();
  await section.scrollIntoViewIfNeeded();
  const field = section
    .locator('[data-slot="field"], [role="group"]')
    .filter({ hasText: new RegExp(`^${label}`) })
    .first();
  await expect(field, `Toolcraft field "${label}" in "${sectionTitle}" should be visible`).toBeVisible();
  return field;
}

async function selectSectionOption(
  page: Page,
  sectionTitle: string,
  label: string,
  optionName: string,
): Promise<void> {
  const field = await getSectionFieldByLabel(page, sectionTitle, label);
  await field.getByRole("combobox").click();
  const option = page
    .locator('[data-slot="select-content"] [role="option"]')
    .filter({ hasText: optionName })
    .first();
  await expect(option, `Select option "${optionName}" should be visible`).toBeVisible();
  await option.click();
}

async function setStreamColorStopHex(
  page: Page,
  stopLabel: string,
  hex: string,
): Promise<void> {
  const field = await getSectionFieldByLabel(page, "Stream Color", stopLabel);
  const hexInput = field.getByRole("textbox", { name: new RegExp(`${stopLabel} hex`, "i") });
  await hexInput.fill(hex);
  await hexInput.press("Enter");
  await expect(hexInput).toHaveValue(hex);
}

async function setSectionSliderValue(
  page: Page,
  sectionTitle: string,
  label: string,
  value: number,
): Promise<void> {
  const field = await getSectionFieldByLabel(page, sectionTitle, label);
  await field.getByRole("button", { name: `Edit ${label} value` }).click();
  const input = field.getByRole("textbox", { name: `${label} value` });
  await expect(input, `Editable slider "${label}" should expose a value editor`).toBeVisible();
  await input.fill(String(value));
  await input.press("Enter");
}

async function selectToolcraftOption(
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

async function setToolcraftColorHex(
  _page: Page,
  field: Locator,
  hex: string,
): Promise<void> {
  const hexInput = field.locator('input[aria-label*="hex" i], input[type="text"]').first();
  await hexInput.fill(hex);
  await hexInput.press("Enter");
}

function readPngSize(buffer: Buffer): { height: number; width: number } {
  return {
    height: buffer.readUInt32BE(20),
    width: buffer.readUInt32BE(16),
  };
}

test("browser: paths edit mode enables canvas overlay", async ({ page }) => {
  await page.goto("/");
  const editField = await getToolcraftFieldByLabel(page, "Edit paths");
  await editField.getByRole("switch").click();
  await expect(page.locator('[data-toolcraft-path-overlay]')).toBeVisible();
});

test("browser: paths reach changes product output", async ({ page }) => {
  await page.goto("/");
  await seedPath(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Reach", 120);
  });
});

test("browser: paths strength changes product output", async ({ page }) => {
  await page.goto("/");
  await seedPath(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Strength", 95);
  });
});

test("browser: add path creates editable spline", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add path" }).click();
  const editField = await getToolcraftFieldByLabel(page, "Edit paths");
  await editField.getByRole("switch").click();
  await expect(page.locator('[data-toolcraft-path-overlay]')).toBeVisible();
});

test("browser: delete path removes active spline", async ({ page }) => {
  await page.goto("/");
  await seedPath(page);
  await page.getByRole("button", { name: "Delete path" }).click();
  await expect(page.locator('[data-toolcraft-path-overlay] path')).toHaveCount(0);
});

test("browser: field preset changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectSectionOption(page, "Field", "Preset", "Storm");
  });
});

test("browser: flow pattern changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectToolcraftOption(page, "Pattern", "Vortex");
  });
});

test("browser: flow direction changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Direction", 45);
  });
});

test("browser: flow scale changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Scale", 72);
  });
});

test("browser: flow swirl changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Swirl", 72);
  });
});

test("browser: flow turbulence changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Turbulence", 72);
  });
});

test("browser: flow seed changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Seed", 842);
  });
});

test("browser: randomize seed changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await page.getByRole("button", { name: "Randomize" }).click();
  });
});

test("browser: streams density changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Density", 42);
  });
});

test("browser: streams length min changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Length min", 60);
  });
});

test("browser: streams length max changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Length max", 360);
  });
});

test("browser: streams length contrast changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Length contrast", 20);
  });
});

test("browser: streams smoothness changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Smoothness", 25);
  });
});

test("browser: stroke style changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectToolcraftOption(page, "Style", "Dash");
  });
});

test("browser: stroke width changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setSectionSliderValue(page, "Stroke", "Width", 10);
  });
});

test("browser: stroke width by speed changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Width by speed", 90);
  });
});

test("browser: stroke taper changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectToolcraftOption(page, "Taper", "Both");
  });
});

test("browser: stroke head size changes product output", async ({ page }) => {
  await page.goto("/");
  await selectToolcraftOption(page, "Style", "Arrow");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Arrow head", 2);
  });
});

test("browser: color palette changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectSectionOption(page, "Palette", "Palette", "Ember");
  });
});

test("browser: color assignment mode changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectSectionOption(page, "Palette", "Assignment", "Vertical gradient");
  });
});

test("browser: color custom slot changes product output", async ({ page }) => {
  await page.goto("/");
  await selectSectionOption(page, "Palette", "Palette", "Custom");
  const hexInput = page.getByRole("textbox", { name: "custom1 hex" });
  await expectToolcraftProductObservableToChange(page, async () => {
    await hexInput.fill("#FF2D55");
    await hexInput.press("Enter");
  });
});

test("browser: streams spacing mode changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectSectionOption(page, "Streams", "Spacing mode", "Packed");
  });
});

test("browser: streams gap changes product output", async ({ page }) => {
  await page.goto("/");
  await selectSectionOption(page, "Streams", "Spacing mode", "Packed");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setSectionSliderValue(page, "Streams", "Gap", 12);
  });
});

test("browser: streams margin changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setSectionSliderValue(page, "Streams", "Margin", 64);
  });
});

test("browser: stroke size variety changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Size variety", 80);
  });
});

test("browser: flow snap angles changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectSectionOption(page, "Field", "Snap angles", "90°");
  });
});

test("browser: shuffle changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await page.getByRole("button", { name: "Shuffle" }).click({ noWaitAfter: true });
  });
});

test("browser: include background changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    const field = await getToolcraftFieldByLabel(page, "Include");
    await field.getByRole("switch").click();
  });
});

test("browser: background color changes product output", async ({ page }) => {
  await page.goto("/");
  const hexInput = page.getByRole("textbox", { name: /background hex/i });
  await expectToolcraftProductObservableToChange(page, async () => {
    await hexInput.fill("#101820");
    await hexInput.press("Enter");
  });
});

test("browser: native preview resolution matches product output", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator(flowCanvasSelector).first();
  await expect(canvas).toBeVisible();
  const metrics = await canvas.evaluate((element) => {
    const node = element as HTMLCanvasElement;
    const rect = node.getBoundingClientRect();
    return {
      backingHeight: node.height,
      backingWidth: node.width,
      previewHeight: node.clientHeight || rect.height,
      previewWidth: node.clientWidth || rect.width,
    };
  });
  expect(metrics.previewWidth).toBeGreaterThan(0);
  expect(metrics.backingWidth).toBeGreaterThanOrEqual(Math.floor(metrics.previewWidth));
});

test("browser: image export format selects encoding", async ({ page }) => {
  await page.goto("/");
  await selectSectionOption(page, "Image Export", "Format", "JPG");
  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export JPG" }).click(),
  ]).then(([event]) => event);
  expect(download.suggestedFilename()).toMatch(/\.jpg$/);
});

test("browser: image export resolution sizes output", async ({ page }) => {
  await page.goto("/");
  await selectSectionOption(page, "Image Export", "Format", "PNG");
  await selectSectionOption(page, "Image Export", "Preset", "8K");
  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PNG" }).click(),
  ]).then(([event]) => event);
  const path = await download.path();
  const buffer = readFileSync(path!);
  const png = readPngSize(buffer);
  expect(Math.max(png.width, png.height)).toBe(8192);
});

test("browser: export svg actions visible for svg format", async ({ page }) => {
  await page.goto("/");
  await selectSectionOption(page, "Image Export", "Format", "SVG");
  await expect(page.getByRole("button", { name: "Export SVG" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy SVG" })).toBeVisible();
  await selectSectionOption(page, "Image Export", "Format", "PNG");
  await expect(page.getByRole("button", { name: "Export PNG" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy PNG" })).toBeVisible();
});

test("browser: export png actions visible for png format", async ({ page }) => {
  await page.goto("/");
  await selectSectionOption(page, "Image Export", "Format", "PNG");
  await expect(page.getByRole("button", { name: "Export PNG" })).toBeVisible();
  await selectSectionOption(page, "Image Export", "Format", "SVG");
  await expect(page.getByRole("button", { name: "Export SVG" })).toBeVisible();
});

test("browser: export jpg actions visible for jpg format", async ({ page }) => {
  await page.goto("/");
  await selectSectionOption(page, "Image Export", "Format", "JPG");
  await expect(page.getByRole("button", { name: "Export JPG" })).toBeVisible();
  await selectSectionOption(page, "Image Export", "Format", "PNG");
  await expect(page.getByRole("button", { name: "Export PNG" })).toBeVisible();
});

test("browser: export and copy actions deliver product output", async ({ page }) => {
  await page.goto("/");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export SVG" }).click(),
  ]).then(([event]) => event);
  const path = await download.path();
  const svg = readFileSync(path!, "utf8");
  expect(svg).toContain('data-flow-strokes=""');
  await page.getByRole("button", { name: "Copy SVG" }).click();
  await expect(page.getByRole("button", { name: "Copy SVG" })).toBeVisible();
});
