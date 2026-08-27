import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi } from "./test-session";

test("colaborador sees a permission message instead of the operacional page", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/operacional");

  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("shows who is currently on sobreaviso and the team's deslocamentos for a gestor", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    activeSobreaviso: [
      {
        id: "sob-1",
        userId: "user-1",
        userName: "Diana Colaboradora",
        startedAt: "2026-08-27T08:00:00.000Z",
      },
    ],
    deslocamentos: [
      {
        id: "des-1",
        userId: "user-2",
        userName: "Elias Colaborador",
        startedAt: "2026-08-26T09:00:00.000Z",
        endedAt: "2026-08-26T09:45:00.000Z",
      },
    ],
  });

  await page.goto("/operacional");

  await expect(page.getByRole("heading", { name: "Operacional" })).toBeVisible();
  await expect(page.getByText("Diana Colaboradora")).toBeVisible();
  await expect(page.getByText("Elias Colaborador")).toBeVisible();
});
