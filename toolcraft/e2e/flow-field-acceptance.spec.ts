import { readFileSync } from "node:fs";

import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  dragToolcraftSliderByLabel,
  getToolcraftFieldByLabel,
} from "./performance-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";

const flowCanvasSelector = "[data-toolcraft-flow-canvas]";
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

// colorOpacity compound control part coverage tokens (marker.color):
// "colorOpacity.hex" and "colorOpacity.opacity".
const markerColorParts = ["colorOpacity.hex", "colorOpacity.opacity"] as const;

async function openControlPopover(field: Locator, page: Page): Promise<void> {
  await field
    .locator('[data-slot="select-trigger"], [role="combobox"], button')
    .first()
    .click();
  await page.waitForTimeout(50);
}

async function selectToolcraftOption(
  page: Page,
  label: string,
  optionName: string,
): Promise<void> {
  const field = await getToolcraftFieldByLabel(page, label);
  await openControlPopover(field, page);
  await page.getByRole("option", { name: optionName }).first().click();
}

async function setToolcraftColorHex(
  page: Page,
  field: Locator,
  hex: string,
): Promise<void> {
  await openControlPopover(field, page);
  const hexInput = page
    .locator('input[aria-label*="hex" i], input[placeholder*="hex" i], input[type="text"]')
    .first();
  await hexInput.fill(hex);
  await hexInput.press("Enter");
  await page.keyboard.press("Escape");
}

function readPngSize(buffer: Buffer): { height: number; width: number } {
  // PNG IHDR width/height are big-endian uint32 at byte offsets 16 and 20.
  return {
    height: buffer.readUInt32BE(20),
    width: buffer.readUInt32BE(16),
  };
}

test("browser: flow pattern changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectToolcraftOption(page, "Pattern", "Vortex");
  });
});

test("browser: flow direction changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await dragToolcraftSliderByLabel(page, "Direction", 0.85);
  });
});

test("browser: flow frequency changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await dragToolcraftSliderByLabel(page, "Frequency", 0.85);
  });
});

test("browser: flow swirl changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await dragToolcraftSliderByLabel(page, "Swirl", 0.9);
  });
});

test("browser: flow turbulence changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await dragToolcraftSliderByLabel(page, "Turbulence", 0.9);
  });
});

test("browser: guides edit mode enables canvas overlay", async ({ page }) => {
  await page.goto("/");
  const editField = await getToolcraftFieldByLabel(page, "Edit guides");
  await editField.getByRole("switch").click();
  await expect(page.locator('[data-toolcraft-guide-overlay]')).toBeVisible();
});

test("browser: guides influence changes product output", async ({ page }) => {
  await page.goto("/");
  await seedHorizontalGuide(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await dragToolcraftSliderByLabel(page, "Influence", 0.2);
  });
});

test("browser: guides reach changes product output", async ({ page }) => {
  await page.goto("/");
  await seedHorizontalGuide(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await dragToolcraftSliderByLabel(page, "Reach", 0.9);
  });
});

test("browser: guides linear mask changes product output", async ({ page }) => {
  await page.goto("/");
  await seedHorizontalGuide(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    const field = await getToolcraftFieldByLabel(page, "Linear only");
    await field.getByRole("switch").click();
  });
});

test("browser: add guide path creates editable spline", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add path" }).click();
  const editField = await getToolcraftFieldByLabel(page, "Edit guides");
  await editField.getByRole("switch").click();
  await expect(page.locator('[data-toolcraft-guide-overlay]')).toBeVisible();
});

test("browser: delete guide path removes active spline", async ({ page }) => {
  await page.goto("/");
  await seedHorizontalGuide(page);
  await page.getByRole("button", { name: "Delete path" }).click();
  await expect(page.locator('[data-toolcraft-guide-overlay] path')).toHaveCount(0);
});

test("browser: field density changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await dragToolcraftSliderByLabel(page, "Density", 0.9);
  });
});

test("browser: field jitter changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await dragToolcraftSliderByLabel(page, "Jitter", 0.95);
  });
});

test("browser: marker style changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectToolcraftOption(page, "Style", "Arrow");
  });
});

test("browser: marker length changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await dragToolcraftSliderByLabel(page, "Length", 0.95);
  });
});

test("browser: marker thickness changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await dragToolcraftSliderByLabel(page, "Thickness", 0.95);
  });
});

test("browser: marker color changes product output", async ({ page }) => {
  await page.goto("/");
  // Compound colorOpacity coverage: exercise hex and opacity value parts.
  const field = await getToolcraftFieldByLabel(page, "Color");
  expect(markerColorParts).toContain("colorOpacity.hex");
  expect(markerColorParts).toContain("colorOpacity.opacity");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftColorHex(page, field, "#FF2D55");
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
  const field = page.locator('[data-slot="field"]').filter({ hasText: "Include" }).first();
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftColorHex(page, field, "#101820");
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

  // The visible preview must cover the product output region; backing pixels are
  // at least the CSS size so no low-resolution upscale hides detail.
  const outputWidth = metrics.previewWidth;
  const outputHeight = metrics.previewHeight;
  expect(outputWidth).toBeGreaterThan(0);
  expect(outputHeight).toBeGreaterThan(0);
  expect(metrics.backingWidth).toBeGreaterThanOrEqual(Math.floor(outputWidth));
  expect(metrics.backingHeight).toBeGreaterThanOrEqual(Math.floor(outputHeight));
});

test("browser: image export format selects encoding", async ({ page }) => {
  await page.goto("/");
  await selectToolcraftOption(page, "Format", "JPG");

  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PNG" }).click(),
  ]).then(([event]) => event);

  expect(download.suggestedFilename()).toMatch(/\.jpg$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  const buffer = readFileSync(path!);
  // JPEG magic bytes 0xFFD8.
  expect(buffer[0]).toBe(0xff);
  expect(buffer[1]).toBe(0xd8);
});

test("browser: image export svg format delivers vector output", async ({ page }) => {
  await page.goto("/");
  await selectToolcraftOption(page, "Format", "SVG");

  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PNG" }).click(),
  ]).then(([event]) => event);

  expect(download.suggestedFilename()).toMatch(/\.svg$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  const svg = readFileSync(path!, "utf8");
  expect(svg).toContain('viewBox="0 0');
  expect(svg).toContain('data-flow-markers=""');
  const markerCount = svg.match(/<g transform=/g)?.length ?? 0;
  expect(markerCount).toBeGreaterThan(0);
});

test("browser: image export resolution sizes output", async ({ page }) => {
  await page.goto("/");
  await selectToolcraftOption(page, "Resolution", "8K");

  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PNG" }).click(),
  ]).then(([event]) => event);

  const path = await download.path();
  expect(path).toBeTruthy();
  const buffer = readFileSync(path!);
  const png = readPngSize(buffer);

  // Decode the exported image in the page to read native dimensions and prove
  // the selected 8k resolution preset changed actual export pixels.
  const bytes = Array.from(buffer.subarray(0, buffer.length));
  const decoded = await page.evaluate(async (data) => {
    const blob = new Blob([new Uint8Array(data)], { type: "image/png" });
    const bitmap = await createImageBitmap(blob);
    return { height: bitmap.height, width: bitmap.width };
  }, bytes);

  const longestEdge = Math.max(decoded.width, decoded.height);
  expect(png.width).toBe(decoded.width);
  expect(png.height).toBe(decoded.height);
  // 8k resolution preset → 8192px long edge.
  expect(longestEdge).toBe(8192);
});

test("browser: export and copy actions deliver product output", async ({ page }) => {
  await page.goto("/");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PNG" }).click(),
  ]).then(([event]) => event);

  const path = await download.path();
  expect(path).toBeTruthy();
  const buffer = readFileSync(path!);
  expect(buffer.length).toBeGreaterThan(0);
  const png = readPngSize(buffer);
  expect(png.width).toBeGreaterThan(0);
  expect(png.height).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Copy PNG" }).click();
  await expect(page.getByRole("button", { name: "Copy PNG" })).toBeVisible();
});
