import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi } from "./test-session";

test("search finds a screen by name and navigates to it", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request);
  await page.goto("/");

  await page.getByRole("button", { name: "Buscar" }).click();
  await page.getByPlaceholder("Buscar telas...").fill("banco");

  await page.getByRole("button", { name: "Banco de Horas" }).click();
  await expect(page).toHaveURL(/\/banco-de-horas$/);
});

test("Ctrl+K opens the search dialog with the input focused", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request);
  await page.goto("/");

  await page.keyboard.press("Control+k");

  await expect(page.getByPlaceholder("Buscar telas...")).toBeFocused();
});

test("only shows screens the viewer's role can access", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await mockApi(request);
  await page.goto("/");

  await page.getByRole("button", { name: "Buscar" }).click();
  await page.getByPlaceholder("Buscar telas...").fill("pagamentos");
  await expect(page.getByText("Nada encontrado")).toBeVisible();

  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await page.goto("/");
  await page.getByRole("button", { name: "Buscar" }).click();
  await page.getByPlaceholder("Buscar telas...").fill("pagamentos");
  await expect(page.getByRole("button", { name: "Pagamentos" })).toBeVisible();
});

test("colaborador can find Ponto via search", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/");

  await page.getByRole("button", { name: "Buscar" }).click();
  await page.getByPlaceholder("Buscar telas...").fill("ponto");

  await expect(page.getByRole("button", { name: "Ponto", exact: true })).toBeVisible();
});

test("colaborador can find Histórico and Folha via search", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/");

  await page.getByRole("button", { name: "Buscar" }).click();
  await page.getByPlaceholder("Buscar telas...").fill("hist");
  await expect(page.getByRole("button", { name: "Histórico de Pontos" })).toBeVisible();

  await page.getByPlaceholder("Buscar telas...").fill("folha");
  await expect(page.getByRole("button", { name: "Folha de Ponto" })).toBeVisible();
});

test("colaborador can find Banco de Horas via search", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/");

  await page.getByRole("button", { name: "Buscar" }).click();
  await page.getByPlaceholder("Buscar telas...").fill("banco");
  await expect(page.getByRole("button", { name: "Banco de Horas" })).toBeVisible();
});

test("colaborador can find Férias via search", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/");

  await page.getByRole("button", { name: "Buscar" }).click();
  await page.getByPlaceholder("Buscar telas...").fill("férias");

  await expect(page.getByRole("button", { name: "Férias" })).toBeVisible();
});

test("colaborador can find Documentos via search", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/");

  await page.getByRole("button", { name: "Buscar" }).click();
  await page.getByPlaceholder("Buscar telas...").fill("documentos");

  await expect(page.getByRole("button", { name: "Documentos" })).toBeVisible();
});

test("colaborador can find Mural via search", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/");

  await page.getByRole("button", { name: "Buscar" }).click();
  await page.getByPlaceholder("Buscar telas...").fill("mural");

  await expect(page.getByRole("button", { name: "Mural" })).toBeVisible();
});
