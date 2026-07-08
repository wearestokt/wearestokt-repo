import { expect, test } from "@playwright/test";

test("browser: flow field app opens as a Toolcraft shell with product controls", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.locator('[data-slot="toolcraft-runtime-app"]')).toBeVisible();
  await expect(page.getByRole("application", { name: "Canvas viewport" })).toBeVisible();
  await expect(page.locator("[data-toolcraft-flow-canvas]")).toBeVisible();

  await expect(page.getByText("Flow Paths", { exact: true })).toBeVisible();
  await expect(page.getByText("Streams", { exact: true })).toBeVisible();
  await expect(page.getByText("Stroke", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export SVG" })).toBeVisible();
});

test("browser: flow field canvas renders product output without app UI text", async ({
  page,
}) => {
  await page.goto("/");

  const canvas = page.locator("[data-toolcraft-flow-canvas]");
  await expect(canvas).toBeVisible();

  await expect(page.getByText("Prompt")).toHaveCount(0);
  await expect(page.getByText("Click to upload")).toHaveCount(0);
});
