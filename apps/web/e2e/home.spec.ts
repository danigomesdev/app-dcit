import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi } from "./test-session";

test("colaborador sees a permission message instead of the team's ponto", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("renders its empty state when there's nothing to show", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Ponto dos funcionários" })).toBeVisible();
});

test("lists each employee's presence and worked time for a gestor", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    team: [
      {
        userId: "colaborador-1",
        name: "Ana Colaboradora",
        entries: [{ id: "1", clockedAt: "2026-08-27T09:00:00.000Z" }],
        workedMinutes: 0,
        isOpen: true,
      },
      {
        userId: "colaborador-2",
        name: "Beto Colaborador",
        entries: [
          { id: "2", clockedAt: "2026-08-27T09:00:00.000Z" },
          { id: "3", clockedAt: "2026-08-27T13:00:00.000Z" },
        ],
        workedMinutes: 240,
        isOpen: false,
      },
    ],
  });

  await page.goto("/");

  await expect(page.getByText("Ana Colaboradora")).toBeVisible();
  await expect(page.getByText("Presente", { exact: true })).toBeVisible();
  await expect(page.getByText("Beto Colaborador")).toBeVisible();
  await expect(page.getByText("Não presente")).toBeVisible();
  await expect(page.getByText("4h 00min hoje")).toBeVisible();
});
