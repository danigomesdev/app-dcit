import { test, expect } from "@playwright/test";

test("login page renders the SSO entry point without the app sidebar", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Ponto DCIT" })).toBeVisible();
  const ssoLink = page.getByRole("link", { name: "Entrar com SSO" });
  await expect(ssoLink).toBeVisible();
  await expect(ssoLink).toHaveAttribute("href", "http://localhost:3000/auth/login?origin=web");
  await expect(page.getByRole("link", { name: "Aprovações" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Documentos" })).toHaveCount(0);
});
