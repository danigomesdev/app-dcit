import { test, expect } from "@playwright/test";

test("sidebar renders both sections and navigates between them", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Aprovações" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Documentos" })).toBeVisible();

  await page.getByRole("link", { name: "Aprovações" }).click();
  await expect(page).toHaveURL(/\/aprovacoes$/);
  await expect(page.getByRole("heading", { name: "Fila de aprovações" })).toBeVisible();

  await page.getByRole("link", { name: "Documentos" }).click();
  await expect(page).toHaveURL(/\/documentos$/);
  await expect(page.getByRole("heading", { name: "Documentos e atestados" })).toBeVisible();
});
