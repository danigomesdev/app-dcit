import { test, expect } from "@playwright/test";

test("home page renders the product name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ponto DCIT" })).toBeVisible();
});
