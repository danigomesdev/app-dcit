import { test, expect } from "@playwright/test";

import { addSessionCookie } from "./test-session";

test("sidebar renders both sections and navigates between them", async ({ page, context }) => {
  await addSessionCookie(context);
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

test("sidebar shows the authenticated user's name and role", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await page.goto("/");

  await expect(page.getByText("Carla RH")).toBeVisible();
  await expect(page.getByText("RH", { exact: true })).toBeVisible();
});
