import { test, expect } from "@playwright/test";

import { addSessionCookie, seedResponse } from "./test-session";

test.use({ timezoneId: "America/Sao_Paulo" });

test("colaborador bate o ponto e vê o horário e as horas trabalhadas", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sem permissão" })).toHaveCount(0);
  await expect(page.getByText("Último ponto: --:--")).toBeVisible();
  await expect(page.getByText("Horas trabalhadas hoje: 0h 00min")).toBeVisible();

  await seedResponse(request, {
    method: "POST",
    path: "/time-entries",
    status: 201,
    response: { id: "te-1", clockedAt: "2026-08-20T12:00:00.000Z" },
  });
  await page.getByRole("button", { name: "Bater Ponto" }).click();
  await expect(page.getByText("Último ponto: 09:00")).toBeVisible();
  await expect(page.getByText("Horas trabalhadas hoje: 0h 00min")).toBeVisible();

  await seedResponse(request, {
    method: "POST",
    path: "/time-entries",
    status: 201,
    response: { id: "te-2", clockedAt: "2026-08-20T13:30:00.000Z" },
  });
  await page.getByRole("button", { name: "Bater Ponto" }).click();
  await expect(page.getByText("Último ponto: 10:30")).toBeVisible();
  await expect(page.getByText("Horas trabalhadas hoje: 1h 30min")).toBeVisible();
});

test("gestor keeps seeing the team presence panel at /, not the punch card", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Bater Ponto" })).toHaveCount(0);
});

test("shows a fallback when location isn't available", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/");
  // The default Playwright browser context has no geolocation permission
  // granted, so the browser's geolocation API errors out immediately.
  await expect(page.getByText("Localização não disponível")).toBeVisible();
});
