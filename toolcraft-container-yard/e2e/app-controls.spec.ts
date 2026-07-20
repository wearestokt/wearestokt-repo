import { expect, test } from "@playwright/test";

test("browser: container yard app opens as a Toolcraft shell with product controls", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.locator('[data-slot="toolcraft-runtime-app"]')).toBeVisible();
  await expect(page.getByRole("application", { name: "Canvas viewport" })).toBeVisible();
  await expect(page.locator("[data-toolcraft-product-canvas]")).toBeVisible();

  await expect(page.getByText("App Mode", { exact: true })).toBeVisible();
  await expect(page.getByText("Container Colors", { exact: true })).toBeVisible();
});

test("browser: container yard canvas renders product output without app UI text", async ({
  page,
}) => {
  await page.goto("/");

  const canvas = page.locator("[data-toolcraft-product-canvas]");
  await expect(canvas).toBeVisible();

  await expect(page.getByText("Prompt")).toHaveCount(0);
});
