import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi } from "./test-session";

test("colaborador sees a permission message instead of the schedule", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/escala");

  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("shows the week's shifts and the add-shift picker for a gestor", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    shifts: [
      {
        id: "sh-1",
        date: "2026-08-31T00:00:00.000Z",
        label: "Manhã",
        userId: "colaborador-1",
        userName: "Ana Colaboradora",
      },
    ],
    employees: [
      { userId: "colaborador-1", name: "Ana Colaboradora" },
      { userId: "gestor-1", name: "Bruno Gestor" },
    ],
  });

  await page.goto("/escala?start=2026-08-31");

  await expect(page.getByText("Segunda")).toBeVisible();
  await expect(page.getByText("Manhã:")).toBeVisible();
  // Scoped to the rendered shift row, not a bare getByText: "Ana Colaboradora"
  // also appears as an <option> in every one of the 7 day selects (the
  // employee roster is repeated per day), which would otherwise trip
  // Playwright's strict-mode "multiple elements matched" check.
  await expect(page.getByRole("listitem").filter({ hasText: "Ana Colaboradora" })).toBeVisible();

  // Each of the 7 day sections renders its own <select> with the full
  // roster — scope to one day's select rather than counting "Bruno Gestor"
  // page-wide (that would match once per day, i.e. 7, not a meaningful
  // number).
  const mondaySelect = page.locator("section", { hasText: "Segunda" }).locator("select[name=userId]");
  await expect(mondaySelect.getByRole("option", { name: "Bruno Gestor" })).toHaveCount(1);
});

test("adding a shift calls the API with the day's date", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request, {
    employees: [{ userId: "gestor-1", name: "Bruno Gestor" }],
  });

  await page.goto("/escala?start=2026-08-31");

  const mondaySection = page.locator("section", { hasText: "Segunda" });
  await mondaySection.getByPlaceholder("Rótulo (ex: Manhã)").fill("Backup");
  await mondaySection.locator("select[name=userId]").selectOption("gestor-1");
  await mondaySection.getByRole("button", { name: "Adicionar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "POST" && r.path === "/operacional/escala"
      )?.body;
    })
    .toEqual({ date: "2026-08-31", label: "Backup", userId: "gestor-1" });
});

test("removing a shift calls the API", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request, {
    shifts: [
      {
        id: "sh-1",
        date: "2026-08-31T00:00:00.000Z",
        label: "Manhã",
        userId: "colaborador-1",
        userName: "Ana Colaboradora",
      },
    ],
  });

  await page.goto("/escala?start=2026-08-31");
  await page.getByRole("button", { name: "Remover" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "DELETE" && r.path === "/operacional/escala/sh-1"
      );
    })
    .toBeTruthy();
});

test("week navigation changes the displayed range", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request);

  await page.goto("/escala?start=2026-08-31");
  await expect(page.getByText("31/08/2026 a 06/09/2026")).toBeVisible();

  await page.getByRole("link", { name: "Próxima semana →" }).click();
  await expect(page).toHaveURL(/start=2026-09-07/);
  await expect(page.getByText("07/09/2026 a 13/09/2026")).toBeVisible();
});
