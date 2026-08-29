import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi } from "./test-session";

test("colaborador sees a permission message instead of the alerts list", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/alertas");

  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("shows the team's jornada alerts for a gestor", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request, {
    jornadaAlerts: [
      {
        id: "alert-1",
        userId: "user-1",
        userName: "Fernanda Colaboradora",
        type: "interjornada",
        date: "2026-09-02T00:00:00.000Z",
        minutesShort: 240,
      },
    ],
  });

  await page.goto("/alertas");

  await expect(page.getByRole("heading", { name: "Alertas" })).toBeVisible();
  await expect(page.getByText("Fernanda Colaboradora")).toBeVisible();
  await expect(page.getByText(/Intervalo entre turnos/)).toBeVisible();
});

test("shows an empty state when there are no alerts", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request, { jornadaAlerts: [] });

  await page.goto("/alertas");

  await expect(page.getByRole("heading", { name: "Alertas" })).toBeVisible();
  await expect(page.getByText("Nenhum alerta de intervalo registrado.")).toBeVisible();
});
