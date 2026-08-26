import { test, expect } from "@playwright/test";

test("login page renders the SSO entry point without the app sidebar", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Ponto DCIT" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar com SSO" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Aprovações" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Documentos" })).toHaveCount(0);
});
