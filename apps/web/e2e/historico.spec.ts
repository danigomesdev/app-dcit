import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi, seedResponse } from "./test-session";

test("gestor and rh see a permission message instead of the history", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await page.goto("/historico");
  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();

  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await page.goto("/historico");
  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("shows an empty state when there's no punch on record", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/historico");
  await expect(page.getByRole("heading", { name: "Histórico de pontos" })).toBeVisible();
  await expect(page.getByText("Nenhum ponto registrado ainda.")).toBeVisible();
});

test("lists every punch, most recent first, in São Paulo time", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  // Explicitly reset the API state to ensure a clean slate
  await request.post("http://localhost:3000/__reset");
  await seedResponse(request, {
    method: "GET",
    path: "/time-entries",
    response: [
      { id: "te-1", clockedAt: "2026-08-19T12:00:00-03:00" },
      { id: "te-2", clockedAt: "2026-08-20T09:30:00-03:00" },
    ],
  });

  await page.goto("/historico");

  // Verify the page heading exists
  await expect(page.getByRole("heading", { name: "Histórico de pontos" })).toBeVisible();

  // Verify both date entries are visible
  await expect(page.getByText("20 de agosto")).toBeVisible();
  await expect(page.getByText("09:30")).toBeVisible();
  await expect(page.getByText("19 de agosto")).toBeVisible();
  await expect(page.getByText("12:00")).toBeVisible();

  // Verify order: 20 de agosto should appear before 19 de agosto in the page (newest first)
  const heading20 = page.getByText("20 de agosto").first();
  const heading19 = page.getByText("19 de agosto").first();
  const box20 = await heading20.boundingBox();
  const box19 = await heading19.boundingBox();
  expect(box20?.y).toBeLessThan(box19?.y || Infinity);
});
