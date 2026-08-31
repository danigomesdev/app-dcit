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
  await mockApi(request);
  await seedResponse(request, {
    method: "GET",
    path: "/time-entries",
    response: [
      { id: "te-1", clockedAt: "2026-08-19T12:00:00-03:00" },
      { id: "te-2", clockedAt: "2026-08-20T09:30:00-03:00" },
    ],
  });

  await page.goto("/historico");

  const rows = page.locator("main ul > li");
  await expect(rows).toHaveCount(2);
  // Newest first: the 08-20 entry comes before the 08-19 one.
  await expect(rows.nth(0)).toContainText("20 de agosto");
  await expect(rows.nth(0)).toContainText("09:30");
  await expect(rows.nth(1)).toContainText("19 de agosto");
  await expect(rows.nth(1)).toContainText("12:00");
});

test("shows a punch's São Paulo calendar day, not its UTC day", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);
  // 22:00 in São Paulo (UTC-3) is already 01:00 the next day in UTC. The
  // existing test above uses -03:00 timestamps whose displayed "09:30"/
  // "12:00" would also survive a regression to ambient/UTC formatting as
  // long as the test host happens to run in SP time, which isn't
  // guaranteed. This timestamp's date only matches in one of the two
  // timezones, so it actually pins the São-Paulo-aware behavior down.
  await seedResponse(request, {
    method: "GET",
    path: "/time-entries",
    response: [{ id: "te-late", clockedAt: "2026-08-20T22:00:00-03:00" }],
  });

  await page.goto("/historico");

  const rows = page.locator("main ul > li");
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toContainText("20 de agosto");
  await expect(rows.nth(0)).not.toContainText("21 de agosto");
});
