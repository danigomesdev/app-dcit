import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi } from "./test-session";

test("sidebar renders both sections and navigates between them", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request);
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Ponto" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Escala" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Aprovações" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Documentos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mural" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Benefícios" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Onboarding" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Operacional" })).toBeVisible();

  await page.getByRole("link", { name: "Aprovações" }).click();
  await expect(page).toHaveURL(/\/aprovacoes$/);
  await expect(page.getByRole("heading", { name: "Fila de aprovações" })).toBeVisible();

  await page.getByRole("link", { name: "Documentos" }).click();
  await expect(page).toHaveURL(/\/documentos$/);
  await expect(page.getByRole("heading", { name: "Documentos e atestados" })).toBeVisible();

  await page.getByRole("link", { name: "Operacional" }).click();
  await expect(page).toHaveURL(/\/operacional$/);
  await expect(page.getByRole("heading", { name: "Operacional" })).toBeVisible();
});

test("highlights the active nav link and only the active one", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request);
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Ponto" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Escala" })).not.toHaveAttribute("aria-current");

  await page.getByRole("link", { name: "Escala" }).click();
  await expect(page).toHaveURL(/\/escala$/);

  await expect(page.getByRole("link", { name: "Escala" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Ponto" })).not.toHaveAttribute("aria-current");
});

test("the user menu shows the authenticated user's name and role, and can log out", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request);
  await page.goto("/");

  await expect(page.getByText("Carla RH")).not.toBeVisible();

  await page.locator('summary[aria-label="Menu do usuário"]').click();

  await expect(page.getByText("Carla RH")).toBeVisible();
  await expect(page.getByText("RH", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
