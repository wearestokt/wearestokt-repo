import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  expectToolcraftSegmentedControlCellsPreservePadding,
  getToolcraftFieldByLabel,
  setToolcraftSliderValue,
} from "./performance-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";

const productObservable = { selector: "[data-toolcraft-product-output]" };

async function seedPath(page: Page): Promise<void> {
  await page.evaluate(() => window.__toolcraftSeedFlowPath?.());
}

async function getSection(page: Page, sectionTitle: string): Promise<Locator> {
  const section = page
    .locator("section")
    .filter({ has: page.getByRole("button", { name: `Collapse ${sectionTitle} section` }) })
    .first();
  await section.scrollIntoViewIfNeeded();
  return section;
}

async function getSectionFieldByLabel(
  page: Page,
  sectionTitle: string,
  label: string,
): Promise<Locator> {
  const section = await getSection(page, sectionTitle);
  const field = section
    .locator('[data-slot="field"], [role="group"]')
    .filter({ hasText: new RegExp(`^${label}`) })
    .first();
  await expect(
    field,
    `Toolcraft field "${label}" in "${sectionTitle}" should be visible`,
  ).toBeVisible();
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

async function switchToDitherMode(page: Page): Promise<void> {
  const modeField = await getSectionFieldByLabel(page, "Texture Mode", "Mode");
  await modeField.getByRole("button", { name: "Dither" }).click();
}

async function fillCodeControl(
  page: Page,
  sectionTitle: string,
  label: string,
  value: string,
): Promise<void> {
  const section = await getSection(page, sectionTitle);
  const textarea = section.getByRole("textbox", { name: label });
  await textarea.fill(value);
  await textarea.blur();
}

async function writePngFixture(
  page: Page,
  width: number,
  height: number,
  paint: "gradient" | "split-alpha",
): Promise<string> {
  const bytes = await page.evaluate(
    async ({ height, paint, width }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas 2D is unavailable.");
      }
      if (paint === "gradient") {
        const gradient = context.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, "#0a0a0a");
        gradient.addColorStop(1, "#f5f5f5");
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
      } else {
        context.clearRect(0, 0, width, height);
        context.fillStyle = "#ffffff";
        context.fillRect(width / 2, 0, width / 2, height);
      }
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
    { height, paint, width },
  );
  const directory = mkdtempSync(join(tmpdir(), "word-tide-"));
  const filePath = join(directory, `${paint}.png`);
  writeFileSync(filePath, Buffer.from(bytes));
  return filePath;
}

async function uploadToSection(
  page: Page,
  sectionTitle: string,
  filePath: string,
): Promise<Locator> {
  const section = await getSection(page, sectionTitle);
  await section.locator('input[type="file"]').first().setInputFiles(filePath);
  const preview = section
    .locator('[data-slot="file-upload-preview-frame"], [data-slot="file-upload-file-item"]')
    .first();
  await expect(preview).toBeVisible();
  return section;
}

async function uploadSourceImage(page: Page): Promise<Locator> {
  const filePath = await writePngFixture(page, 1920, 1080, "gradient");
  return uploadToSection(page, "Source Image", filePath);
}

async function uploadMaskImage(page: Page): Promise<Locator> {
  const filePath = await writePngFixture(page, 1920, 1080, "split-alpha");
  return uploadToSection(page, "Shape Mask", filePath);
}

function readPngSize(buffer: Buffer): { height: number; width: number } {
  return {
    height: buffer.readUInt32BE(20),
    width: buffer.readUInt32BE(16),
  };
}

test("browser: render mode switches layout engines", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftSegmentedControlCellsPreservePadding(page, "Mode");
  await expectToolcraftProductObservableToChange(page, async () => {
    await switchToDitherMode(page);
  }, productObservable);
  await expectToolcraftProductObservableToChange(page, async () => {
    const modeField = await getSectionFieldByLabel(page, "Texture Mode", "Mode");
    await modeField.getByRole("button", { name: "Flow" }).click();
  }, productObservable);
});

test("browser: seed changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Seed", 842);
  }, productObservable);
});

test("browser: randomize changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await page.getByRole("button", { name: "Randomize" }).click();
  }, productObservable);
});

test("browser: word list changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await fillCodeControl(page, "Words", "Word list", "SIGNAL BUOY LATITUDE LONGITUDE");
  }, productObservable);
});

test("browser: word order changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectSectionOption(page, "Words", "Word order", "Random");
  }, productObservable);
  await expectToolcraftProductObservableToChange(page, async () => {
    await selectSectionOption(page, "Words", "Word order", "Sequential");
  }, productObservable);
});

test("browser: source image drives ink lifecycle", async ({ page }) => {
  await page.goto("/");
  let section: Locator | null = null;
  await expectToolcraftProductObservableToChange(page, async () => {
    section = await uploadSourceImage(page);
  }, productObservable);

  await expectToolcraftProductObservableToChange(page, async () => {
    await section!.getByRole("button", { name: "90° Right" }).click();
  }, productObservable);

  await expectToolcraftProductObservableToChange(page, async () => {
    await section!.getByRole("button", { name: "Flip horizontal" }).click();
  }, productObservable);

  await expectToolcraftProductObservableToChange(page, async () => {
    await section!.getByRole("button", { name: /Remove/ }).first().click();
  }, productObservable);

  await expect(
    section!.locator('[data-slot="file-upload-preview-frame"], [data-slot="file-upload-file-item"]'),
  ).toHaveCount(0);
});

test("browser: contrast changes product output", async ({ page }) => {
  await page.goto("/");
  await uploadSourceImage(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Source levels", 80);
  }, productObservable);
});

test("browser: invert flips ink reading", async ({ page }) => {
  await page.goto("/");
  await uploadSourceImage(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    const field = await getSectionFieldByLabel(page, "Source Image", "Invert");
    await field.getByRole("switch").click();
  }, productObservable);
});

test("browser: fade maps ink to opacity", async ({ page }) => {
  await page.goto("/");
  await uploadSourceImage(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    const field = await getSectionFieldByLabel(page, "Ink Mapping", "Fade");
    await field.getByRole("switch").click();
  }, productObservable);
});

test("browser: color count maps ink to palette", async ({ page }) => {
  await page.goto("/");
  await uploadSourceImage(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Color count", 4);
  }, productObservable);
});

test("browser: sparsity drops words from light areas", async ({ page }) => {
  await page.goto("/");
  await uploadSourceImage(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Sparsity", 70);
  }, productObservable);
});

test("browser: tone zones enable band word lists", async ({ page }) => {
  await page.goto("/");
  await switchToDitherMode(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    const field = await getSectionFieldByLabel(page, "Tone Zones", "Enable");
    await field.getByRole("switch").click();
  }, productObservable);
});

test("browser: zone split moves band boundaries", async ({ page }) => {
  await page.goto("/");
  await switchToDitherMode(page);
  const enableField = await getSectionFieldByLabel(page, "Tone Zones", "Enable");
  await enableField.getByRole("switch").click();

  const coveredParts = ["rangeSlider.lower", "rangeSlider.upper"] as const;
  expect(coveredParts.length).toBe(2);

  const splitField = await getSectionFieldByLabel(page, "Tone Zones", "Band split");
  const thumbs = splitField.getByRole("slider");
  await expect(thumbs).toHaveCount(2);

  await expectToolcraftProductObservableToChange(page, async () => {
    await thumbs.first().focus();
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.press("ArrowLeft");
    }
  }, productObservable);

  await expectToolcraftProductObservableToChange(page, async () => {
    await thumbs.last().focus();
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.press("ArrowRight");
    }
  }, productObservable);
});

async function enableToneZones(page: Page): Promise<void> {
  await switchToDitherMode(page);
  const field = await getSectionFieldByLabel(page, "Tone Zones", "Enable");
  await field.getByRole("switch").click();
}

test("browser: dark zone words change product output", async ({ page }) => {
  await page.goto("/");
  await enableToneZones(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await fillCodeControl(page, "Tone Zones", "Dark words", "ABYSS TRENCH");
  }, productObservable);
});

test("browser: mid zone words change product output", async ({ page }) => {
  await page.goto("/");
  await enableToneZones(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await fillCodeControl(page, "Tone Zones", "Mid words", "KEEL RUDDER");
  }, productObservable);
});

test("browser: light zone words change product output", async ({ page }) => {
  await page.goto("/");
  await enableToneZones(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await fillCodeControl(page, "Tone Zones", "Light words", "GULL BREEZE");
  }, productObservable);
});

test("browser: grid gap changes word packing", async ({ page }) => {
  await page.goto("/");
  await switchToDitherMode(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Gap", 30);
  }, productObservable);
});

test("browser: overlap packs dark ink words", async ({ page }) => {
  await page.goto("/");
  await switchToDitherMode(page);
  await uploadSourceImage(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    const field = await getSectionFieldByLabel(page, "Word Grid", "Overlap");
    await field.getByRole("switch").click();
  }, productObservable);
});

test("browser: grid jitter offsets slots", async ({ page }) => {
  await page.goto("/");
  await switchToDitherMode(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Jitter", 80);
  }, productObservable);
});

test("browser: tone spacing tightens zones", async ({ page }) => {
  await page.goto("/");
  await switchToDitherMode(page);
  await uploadSourceImage(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Tone spacing", -80);
  }, productObservable);
});

test("browser: spacing range changes tone gap strength", async ({ page }) => {
  await page.goto("/");
  await switchToDitherMode(page);
  await uploadSourceImage(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Spacing range", 100);
  }, productObservable);
});

test("browser: flow pattern changes word streams", async ({ page }) => {
  await page.goto("/");
  for (const pattern of ["Waves", "Vortex", "Radial", "Turbulent", "Currents"]) {
    await expectToolcraftProductObservableToChange(page, async () => {
      await selectSectionOption(page, "Flow Field", "Pattern", pattern);
    }, productObservable);
  }
});

test("browser: flow direction changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Direction", 45);
  }, productObservable);
});

test("browser: flow scale changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Scale", 32);
  }, productObservable);
});

test("browser: flow swirl changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Swirl", 80);
  }, productObservable);
});

test("browser: flow turbulence changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Turbulence", 80);
  }, productObservable);
});

test("browser: paths edit mode enables canvas overlay", async ({ page }) => {
  await page.goto("/");
  const editField = await getToolcraftFieldByLabel(page, "Edit paths");
  await editField.getByRole("switch").click();
  await expect(page.locator("[data-toolcraft-path-overlay]")).toBeVisible();
});

test("browser: paths reach changes product output", async ({ page }) => {
  await page.goto("/");
  await seedPath(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Reach", 130);
  }, productObservable);
});

test("browser: paths strength changes product output", async ({ page }) => {
  await page.goto("/");
  await seedPath(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Strength", 95);
  }, productObservable);
});

test("browser: add path creates editable spline", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add path" }).click();
  const editField = await getToolcraftFieldByLabel(page, "Edit paths");
  await editField.getByRole("switch").click();
  await expect(page.locator("[data-toolcraft-path-overlay]")).toBeVisible();
});

test("browser: delete path removes active spline", async ({ page }) => {
  await page.goto("/");
  await seedPath(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await page.getByRole("button", { name: "Delete path" }).click();
  }, productObservable);
});

test("browser: density changes stream packing", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Density", 90);
  }, productObservable);
});

test("browser: word gap changes stream spacing", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Word gap", 50);
  }, productObservable);
});

test("browser: font size styles every word", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Font size", 28);
  }, productObservable);
});

test("browser: palette colors repaint words", async ({ page }) => {
  await page.goto("/");
  await setToolcraftSliderValue(page, "Color count", 4);
  await expectToolcraftProductObservableToChange(page, async () => {
    const colorsSection = await getSection(page, "Brand Palette");
    const hexInput = colorsSection.getByRole("textbox", { name: /hex/i }).first();
    await hexInput.fill("#FF0044");
    await hexInput.press("Enter");
  }, productObservable);
});

test("browser: highlight words mark matches", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    const field = await getSectionFieldByLabel(page, "Highlights", "Words");
    const input = field.getByRole("textbox").first();
    await input.fill("OCEAN");
    await input.press("Enter");
  }, productObservable);
});

test("browser: highlight color changes marker fill", async ({ page }) => {
  await page.goto("/");
  await setToolcraftSliderValue(page, "Coverage", 40);
  await expectToolcraftProductObservableToChange(page, async () => {
    const highlightSection = await getSection(page, "Highlights");
    const hexInput = highlightSection.getByRole("textbox", { name: /hex/i }).first();
    await hexInput.fill("#FF6B4A");
    await hexInput.press("Enter");
  }, productObservable);
});

test("browser: highlight coverage marks random words", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Coverage", 60);
  }, productObservable);
});

test("browser: shape mask constrains placement lifecycle", async ({ page }) => {
  await page.goto("/");
  let section: Locator | null = null;
  await expectToolcraftProductObservableToChange(page, async () => {
    section = await uploadMaskImage(page);
  }, productObservable);

  await expectToolcraftProductObservableToChange(page, async () => {
    await section!.getByRole("button", { name: "90° Right" }).click();
  }, productObservable);

  await expectToolcraftProductObservableToChange(page, async () => {
    await section!.getByRole("button", { name: "Flip horizontal" }).click();
  }, productObservable);

  await expectToolcraftProductObservableToChange(page, async () => {
    await section!.getByRole("button", { name: /Remove/ }).first().click();
  }, productObservable);

  await expect(
    section!.locator('[data-slot="file-upload-preview-frame"], [data-slot="file-upload-file-item"]'),
  ).toHaveCount(0);
});

test("browser: mask invert flips placement region", async ({ page }) => {
  await page.goto("/");
  await uploadMaskImage(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    const field = await getSectionFieldByLabel(page, "Shape Mask", "Invert");
    await field.getByRole("switch").click();
  }, productObservable);
});

test("browser: mask feather softens edge words", async ({ page }) => {
  await page.goto("/");
  await uploadMaskImage(page);
  await expectToolcraftProductObservableToChange(page, async () => {
    await setToolcraftSliderValue(page, "Feather", 40);
  }, productObservable);
});

test("browser: include background changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    const field = await getSectionFieldByLabel(page, "Background", "Include");
    await field.getByRole("switch").click();
  }, productObservable);
});

test("browser: background color changes product output", async ({ page }) => {
  await page.goto("/");
  await expectToolcraftProductObservableToChange(page, async () => {
    const backgroundSection = await getSection(page, "Background");
    const hexInput = backgroundSection.getByRole("textbox", { name: /hex/i }).first();
    await hexInput.fill("#101820");
    await hexInput.press("Enter");
  }, productObservable);
});

test("browser: image export format selects encoding", async ({ page }) => {
  await page.goto("/");

  await selectSectionOption(page, "Image Export", "Format", "JPG");
  const jpgDownload = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export JPG" }).click(),
  ]).then(([event]) => event);
  expect(jpgDownload.suggestedFilename()).toMatch(/\.jpg$/);
  const jpgBuffer = readFileSync((await jpgDownload.path())!);
  expect(jpgBuffer[0]).toBe(0xff);
  expect(jpgBuffer[1]).toBe(0xd8);

  await selectSectionOption(page, "Image Export", "Format", "PNG");
  const pngDownload = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PNG" }).click(),
  ]).then(([event]) => event);
  expect(pngDownload.suggestedFilename()).toMatch(/\.png$/);

  await selectSectionOption(page, "Image Export", "Format", "SVG");
  const svgDownload = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export SVG" }).click(),
  ]).then(([event]) => event);
  expect(svgDownload.suggestedFilename()).toMatch(/\.svg$/);
  const svg = readFileSync((await svgDownload.path())!, "utf8");
  expect(svg).toContain("<svg");
  expect(svg).toContain("<text");
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

  const buffer = readFileSync((await download.path())!);
  const png = readPngSize(buffer);
  expect(Math.max(png.width, png.height)).toBe(8192);

  await selectSectionOption(page, "Image Export", "Preset", "2K");
  const smaller = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PNG" }).click(),
  ]).then(([event]) => event);
  const smallerPng = readPngSize(readFileSync((await smaller.path())!));
  expect(Math.max(smallerPng.width, smallerPng.height)).toBe(2048);
});

test("browser: svg text mode switches text and outlines", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await selectSectionOption(page, "Image Export", "Format", "SVG");

  await selectSectionOption(page, "Image Export", "SVG text", "Editable text");
  const editableDownload = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export SVG" }).click(),
  ]).then(([event]) => event);
  const editable = readFileSync((await editableDownload.path())!, "utf8");
  expect(editable).toContain("<text");

  await selectSectionOption(page, "Image Export", "SVG text", "Outlined paths");
  const outlinedDownload = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export SVG" }).click(),
  ]).then(([event]) => event);
  const outlined = readFileSync((await outlinedDownload.path())!, "utf8");
  expect(outlined).toContain('<path d="M');
});

test("browser: export svg actions visible for svg format", async ({ page }) => {
  await page.goto("/");
  await selectSectionOption(page, "Image Export", "Format", "SVG");
  await expect(page.getByRole("button", { name: "Export SVG" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy SVG" })).toBeVisible();
  await selectSectionOption(page, "Image Export", "Format", "PNG");
  await expect(page.getByRole("button", { name: "Export SVG" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export PNG" })).toBeVisible();
});

test("browser: export png actions visible for png format", async ({ page }) => {
  await page.goto("/");
  await selectSectionOption(page, "Image Export", "Format", "PNG");
  await expect(page.getByRole("button", { name: "Export PNG" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy PNG" })).toBeVisible();
  await selectSectionOption(page, "Image Export", "Format", "SVG");
  await expect(page.getByRole("button", { name: "Export PNG" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export SVG" })).toBeVisible();
});

test("browser: export jpg actions visible for jpg format", async ({ page }) => {
  await page.goto("/");
  await selectSectionOption(page, "Image Export", "Format", "JPG");
  await expect(page.getByRole("button", { name: "Export JPG" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy JPG" })).toBeVisible();
  await selectSectionOption(page, "Image Export", "Format", "PNG");
  await expect(page.getByRole("button", { name: "Export JPG" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export PNG" })).toBeVisible();
});

declare global {
  interface Window {
    __toolcraftSeedFlowPath?: () => void;
  }
}
