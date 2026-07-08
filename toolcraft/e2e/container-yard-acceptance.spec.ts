import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  dragToolcraftSliderByLabel,
  expectToolcraftDiscreteSliderDragSmoothness,
  getToolcraftFieldByLabel,
  setToolcraftSliderValue,
} from "./performance-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";

const yardCanvasSelector = "[data-toolcraft-product-canvas]";
const canvasObservable = { selector: yardCanvasSelector };

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
  const directory = mkdtempSync(join(tmpdir(), "yard-source-"));
  const filePath = join(directory, "gradient.png");
  writeFileSync(filePath, Buffer.from(bytes));
  return filePath;
}

async function uploadSourceImage(page: Page, width = 960, height = 540): Promise<void> {
  const filePath = await writeGradientPng(page, width, height);
  const section = page
    .locator("section")
    .filter({ has: page.getByRole("button", { name: "Collapse App Mode section" }) })
    .first();
  await section.locator('input[type="file"]').setInputFiles(filePath);
  await expect(
    section.locator('[data-slot="file-upload-preview-frame"], [data-slot="file-upload-file-item"]').first(),
  ).toBeVisible();
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
  const combobox = field.getByRole("combobox");
  await combobox.click();
  const option = page
    .locator('[data-slot="select-content"] [role="option"]')
    .filter({ hasText: optionName })
    .first();
  await expect(option, `Select option "${optionName}" should be visible`).toBeVisible();
  await option.click();
}

async function selectToolcraftOption(
  page: Page,
  label: string,
  optionName: string,
): Promise<void> {
  const field = await getToolcraftFieldByLabel(page, label);
  await field.getByRole("combobox").click();
  const option = page.getByRole("option", { name: optionName });
  if ((await option.count()) > 0) {
    await option.first().click();
    return;
  }
  await page.getByText(optionName, { exact: true }).click();
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
  const colorButton = section.locator('[data-slot="color-trigger"], button[aria-label*="color" i]').nth(index);
  await colorButton.click();
  const hexInput = page.getByRole("textbox", { name: /hex/i }).first();
  await hexInput.fill(hex);
  await hexInput.press("Enter");
  await page.keyboard.press("Escape");
}

function readPngSize(buffer: Buffer): { height: number; width: number } {
  return {
    height: buffer.readUInt32BE(20),
    width: buffer.readUInt32BE(16),
  };
}

test("browser: orientation changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectToolcraftOption(page, "Orientation", "Horizontal");
  }, canvasObservable);
});

test("browser: layout changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectToolcraftOption(page, "Stagger axis", "Columns");
  }, canvasObservable);
});

test("browser: container width changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Width", 48);
  }, canvasObservable);
});

test("browser: length short changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Length short", 96);
  }, canvasObservable);
});

test("browser: length long changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Length long", 180);
  }, canvasObservable);
});

test("browser: length mix changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Long mix", 80);
  }, canvasObservable);
});

test("browser: column gap changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Column gap", 12);
  }, canvasObservable);
});

test("browser: row gap changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Row gap", 12);
  }, canvasObservable);
});

test("browser: stagger changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Stagger", 90);
  }, canvasObservable);
});

test("browser: rotation changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Rotation", 25);
  }, canvasObservable);
});

test("browser: offset changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    const field = await getToolcraftFieldByLabel(page, "Offset");
    const pad = field.locator('[data-slot="vector-pad"]').first();
    const box = await pad.boundingBox();
    if (!box) {
      throw new Error("Offset vector pad is missing.");
    }
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.75);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25);
    await page.mouse.up();
  }, canvasObservable);
});

test("browser: global scale changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Global scale", 150);
  }, canvasObservable);
});

test("browser: random gaps changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Gaps", 35);
  }, canvasObservable);
});

test("browser: contain toggle changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    const field = await getToolcraftFieldByLabel(page, "Contain");
    await field.getByRole("switch").click();
  }, canvasObservable);
});

test("browser: color count changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Colors", 3);
  }, canvasObservable);
});

test("browser: color mode wave changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectToolcraftOption(page, "Color mode", "Wave");
  }, canvasObservable);
});

test("browser: wave axis changes product output", async ({ page }) => {
  await page.goto("/");
  await selectToolcraftOption(page, "Color mode", "Wave");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectToolcraftOption(page, "Wave axis", "Radial");
  }, canvasObservable);
});

test("browser: wave cycles changes product output", async ({ page }) => {
  await page.goto("/");
  await selectToolcraftOption(page, "Color mode", "Wave");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Wave cycles", 6);
  }, canvasObservable);
});

test("browser: color mode zones changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectToolcraftOption(page, "Color mode", "Zones");
  }, canvasObservable);
});

test("browser: zone axis changes product output", async ({ page }) => {
  await page.goto("/");
  await selectToolcraftOption(page, "Color mode", "Zones");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectSectionOption(page, "Brand Zones", "Zone axis", "Vertical");
  }, canvasObservable);
});

test("browser: zone count changes product output", async ({ page }) => {
  await page.goto("/");
  await selectToolcraftOption(page, "Color mode", "Zones");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectSectionOption(page, "Brand Zones", "Zone count", "3 zones");
  }, canvasObservable);
});

test("browser: zone 1 slot changes product output", async ({ page }) => {
  await page.goto("/");
  await selectToolcraftOption(page, "Color mode", "Zones");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Zone 1", 3);
  }, canvasObservable);
});

test("browser: zone 2 slot changes product output", async ({ page }) => {
  await page.goto("/");
  await selectToolcraftOption(page, "Color mode", "Zones");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Zone 2", 4);
  }, canvasObservable);
});

test("browser: zone 3 slot changes product output", async ({ page }) => {
  await page.goto("/");
  await selectToolcraftOption(page, "Color mode", "Zones");
  await selectSectionOption(page, "Brand Zones", "Zone count", "3 zones");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Zone 3", 5);
  }, canvasObservable);
});

test("browser: zone 4 slot changes product output", async ({ page }) => {
  await page.goto("/");
  await selectToolcraftOption(page, "Color mode", "Zones");
  await selectSectionOption(page, "Brand Zones", "Zone count", "4 zones");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Zone 4", 6);
  }, canvasObservable);
});

test("browser: color mode stripes changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectToolcraftOption(page, "Color mode", "Zones");
    await selectToolcraftOption(page, "Color mode", "Stripes");
  }, canvasObservable);
});

test("browser: stripe orientation changes product output", async ({ page }) => {
  await page.goto("/");
  await selectToolcraftOption(page, "Color mode", "Stripes");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectSectionOption(page, "Highlight Stripes", "Stripe axis", "Horizontal");
  }, canvasObservable);
});

test("browser: stripe repeat changes product output", async ({ page }) => {
  await page.goto("/");
  await selectToolcraftOption(page, "Color mode", "Stripes");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Stripe count", 10);
  }, canvasObservable);
});

test("browser: stripe width changes product output", async ({ page }) => {
  await page.goto("/");
  await selectToolcraftOption(page, "Color mode", "Stripes");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Stripe width", 70);
  }, canvasObservable);
});

test("browser: stripe color slot changes product output", async ({ page }) => {
  await page.goto("/");
  await selectToolcraftOption(page, "Color mode", "Stripes");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Highlight", 2);
  }, canvasObservable);
});

test("browser: color mode checker changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectToolcraftOption(page, "Color mode", "Checker");
  }, canvasObservable);
});

test("browser: color mode quadrants changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectToolcraftOption(page, "Color mode", "Quadrants");
  }, canvasObservable);
});

test("browser: color mode rings changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectToolcraftOption(page, "Color mode", "Rings");
  }, canvasObservable);
});

test("browser: color mode clusters changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectToolcraftOption(page, "Color mode", "Clusters");
  }, canvasObservable);
});

test("browser: color mode chevron changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectToolcraftOption(page, "Color mode", "Chevron");
  }, canvasObservable);
});

test("browser: pattern step changes product output", async ({ page }) => {
  await page.goto("/");
  await selectToolcraftOption(page, "Color mode", "Checker");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Pattern step", 8);
  }, canvasObservable);
});

test("browser: seed changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Seed", 128);
  }, canvasObservable);
});

test("browser: shuffle action reshuffles pattern", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await page.getByRole("button", { name: "Shuffle" }).click();
  }, canvasObservable);
});

test("browser: palette color 1 changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setSectionColorHex(page, "Container Colors", 0, "#00FFAA");
  }, canvasObservable);
});

test("browser: palette color 2 changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setSectionColorHex(page, "Container Colors", 1, "#AA00FF");
  }, canvasObservable);
});

test("browser: palette color 3 changes product output", async ({ page }) => {
  await page.goto("/");
  await setToolcraftSliderValue(page, "Colors", 6);
  await expectToolcraftProductObservableToChange(page, async () => {
    await setSectionColorHex(page, "Container Colors", 2, "#FFAA00");
  }, canvasObservable);
});

test("browser: palette color 4 changes product output", async ({ page }) => {
  await page.goto("/");
  await setToolcraftSliderValue(page, "Colors", 6);
  await expectToolcraftProductObservableToChange(page, async () => {
    await setSectionColorHex(page, "Container Colors", 3, "#00AAFF");
  }, canvasObservable);
});

test("browser: palette color 5 changes product output", async ({ page }) => {
  await page.goto("/");
  await setToolcraftSliderValue(page, "Colors", 6);
  await expectToolcraftProductObservableToChange(page, async () => {
    await setSectionColorHex(page, "Container Colors", 4, "#FF0055");
  }, canvasObservable);
});

test("browser: palette color 6 changes product output", async ({ page }) => {
  await page.goto("/");
  await setToolcraftSliderValue(page, "Colors", 6);
  await expectToolcraftProductObservableToChange(page, async () => {
    await setSectionColorHex(page, "Container Colors", 5, "#55FF00");
  }, canvasObservable);
});

test("browser: palette color 7 changes product output", async ({ page }) => {
  await page.goto("/");
  await setToolcraftSliderValue(page, "Colors", 7);
  await expectToolcraftProductObservableToChange(page, async () => {
    await setSectionColorHex(page, "Container Colors", 6, "#5500FF");
  }, canvasObservable);
});

test("browser: palette color 8 changes product output", async ({ page }) => {
  await page.goto("/");
  await setToolcraftSliderValue(page, "Colors", 8);
  await expectToolcraftProductObservableToChange(page, async () => {
    await setSectionColorHex(page, "Container Colors", 7, "#FFFF00");
  }, canvasObservable);
});

test("browser: shadow enabled changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    const field = await getToolcraftFieldByLabel(page, "Shadow");
    await field.getByRole("switch").click();
  }, canvasObservable);
});

test("browser: shadow offset x changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Shadow X", 14);
  }, canvasObservable);
});

test("browser: shadow offset y changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Shadow Y", 14);
  }, canvasObservable);
});

test("browser: shadow opacity changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Shadow opacity", 70);
  }, canvasObservable);
});

test("browser: include background changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    const field = await getToolcraftFieldByLabel(page, "Include");
    await field.getByRole("switch").click();
  }, canvasObservable);
});

test("browser: background color changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    const hexInput = page.getByRole("textbox", { name: "background hex" });
    await hexInput.fill("#101820");
    await hexInput.press("Enter");
  }, canvasObservable);
});

test("browser: canvas render scale changes backing pixels", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftDiscreteSliderDragSmoothness(page, "Resolution scale", {
    maxFrameGapMs: 200,
    maxInteractionMs: 2000,
  });
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Resolution scale", 1);
  }, canvasObservable);
});

test("browser: canvas preview matches product output dimensions", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(yardCanvasSelector)).toBeVisible();
  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector("[data-toolcraft-product-canvas]") as HTMLCanvasElement | null;
    const editable = document.querySelector("[data-toolcraft-editable-canvas]") as HTMLElement | null;
    const rect = canvas?.getBoundingClientRect();
    return {
      clientWidth: rect?.width ?? 0,
      clientHeight: rect?.height ?? 0,
      outputWidth: Number(editable?.getAttribute("data-canvas-width") ?? canvas?.width ?? 0),
      outputHeight: Number(editable?.getAttribute("data-canvas-height") ?? canvas?.height ?? 0),
      previewWidth: canvas?.width ?? 0,
      previewHeight: canvas?.height ?? 0,
    };
  });
  expect(metrics.previewWidth).toBeGreaterThan(0);
  expect(metrics.previewHeight).toBeGreaterThan(0);
  expect(metrics.outputWidth).toBeGreaterThan(0);
  expect(metrics.outputHeight).toBeGreaterThan(0);
});

test("browser: image export format selects encoding", async ({ page }) => {
  await page.goto("/");
  await selectSectionOption(page, "Image Export", "Format", "JPG");

  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export JPG" }).click(),
  ]).then(([event]) => event);

  expect(download.suggestedFilename()).toMatch(/\.jpg$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  const buffer = readFileSync(path!);
  expect(buffer[0]).toBe(0xff);
  expect(buffer[1]).toBe(0xd8);
});

test("browser: image export svg format delivers vector output", async ({ page }) => {
  await page.goto("/");

  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export SVG" }).click(),
  ]).then(([event]) => event);

  expect(download.suggestedFilename()).toMatch(/\.svg$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  const svg = readFileSync(path!, "utf8");
  expect(svg).toContain('viewBox="0 0');
  expect(svg).toContain("<rect");
  expect(svg.match(/<rect/g)?.length ?? 0).toBeGreaterThan(0);
});

test("browser: image export resolution sizes output", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await selectSectionOption(page, "Image Export", "Format", "PNG");
  await selectSectionOption(page, "Image Export", "Preset", "8K");

  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PNG" }).click(),
  ]).then(([event]) => event);

  const path = await download.path();
  expect(path).toBeTruthy();
  const buffer = readFileSync(path!);
  const png = readPngSize(buffer);
  const decodedSize = await page.evaluate(async (bytes) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
    const image = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return image;
  }, Array.from(buffer));
  expect(decodedSize.width).toBe(png.width);
  expect(decodedSize.height).toBe(png.height);
  expect(Math.max(decodedSize.width, decodedSize.height)).toBeGreaterThanOrEqual(8192);
});

test("browser: export and copy actions deliver product output", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");

  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export SVG" }).click(),
  ]).then(([event]) => event);
  expect(download.suggestedFilename()).toMatch(/\.svg$/);

  await page.getByRole("button", { name: "Copy SVG" }).click();
  const clipboard = await page.evaluate(async () => navigator.clipboard.read());
  expect(clipboard.length).toBeGreaterThan(0);
});

test("browser: layout type radial changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectSectionOption(page, "App Mode", "App mode", "Radial");
  }, canvasObservable);
});

test("browser: radial align changes product output", async ({ page }) => {
  await page.goto("/");
  await selectSectionOption(page, "App Mode", "App mode", "Radial");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectSectionOption(page, "App Mode", "Ring align", "Radial");
  }, canvasObservable);
});

test("browser: source image upload dithers product output", async ({ page }) => {
  await page.goto("/");
  await selectSectionOption(page, "App Mode", "App mode", "ASCII");
  await expectToolcraftProductObservableToChange(page, async () => {
    await uploadSourceImage(page);
  }, canvasObservable);
});

async function prepareASCIISource(page: Page): Promise<void> {
  await selectSectionOption(page, "App Mode", "App mode", "ASCII");
  await uploadSourceImage(page);
}

test("browser: dither strength changes product output", async ({ page }) => {
  await page.goto("/");
  await prepareASCIISource(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await dragToolcraftSliderByLabel(page, "Image Mix");
  }, canvasObservable);
});

test("browser: dither algorithm changes product output", async ({ page }) => {
  await page.goto("/");
  await prepareASCIISource(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectSectionOption(page, "App Mode", "Style", "Mono");
  }, canvasObservable);
});

test("browser: dither contrast changes product output", async ({ page }) => {
  await page.goto("/");
  await prepareASCIISource(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await dragToolcraftSliderByLabel(page, "Image Contrast");
  }, canvasObservable);
});

test("browser: dither enabled toggles image blend", async ({ page }) => {
  await page.goto("/");
  await selectSectionOption(page, "App Mode", "App mode", "ASCII");
  await uploadSourceImage(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectSectionOption(page, "App Mode", "App mode", "Rectangular");
  }, canvasObservable);
});

test("browser: ascii palette seed changes product output", async ({ page }) => {
  await page.goto("/");
  await prepareASCIISource(page);
  await selectSectionOption(page, "App Mode", "Style", "Palette");
  await expectToolcraftProductObservableToChange(page, async () => {
    await page.getByRole("button", { name: "Shuffle" }).click();
  }, canvasObservable);
});

test("browser: matte style changes product output", async ({ page }) => {
  await page.goto("/");
  await prepareASCIISource(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectSectionOption(page, "App Mode", "Subject matte", "Auto");
  }, canvasObservable);
});

test("browser: matte min coverage changes product output", async ({ page }) => {
  await page.goto("/");
  await prepareASCIISource(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await dragToolcraftSliderByLabel(page, "Min coverage");
  }, canvasObservable);
});

test("browser: local settings persist after browser reload", async ({ page }) => {
  await page.goto("/");
  const containField = await getSectionFieldByLabel(page, "Grid Layout", "Contain");
  const containSwitch = containField.getByRole("switch");
  await containSwitch.click();
  await expect(containSwitch).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(page.locator(yardCanvasSelector)).toBeVisible();
  const reloadedContain = (await getSectionFieldByLabel(page, "Grid Layout", "Contain")).getByRole(
    "switch",
  );
  await expect(reloadedContain).toHaveAttribute("aria-checked", "true");
});
