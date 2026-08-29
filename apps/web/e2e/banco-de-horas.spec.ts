import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi } from "./test-session";

test("colaborador sees a permission message instead of the team's banco de horas", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/banco-de-horas");

  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("shows the team's banco de horas for a gestor, including a missing salário as —", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    bancoDeHorasEquipe: [
      {
        userId: "user-1",
        userName: "Fernanda Colaboradora",
        balanceMinutes: -120,
        dsrMinutes: 0,
        hourlyRateBRL: null,
        overtimeValueBRL: null,
      },
    ],
  });

  await page.goto("/banco-de-horas");

  await expect(page.getByRole("heading", { name: "Banco de Horas" })).toBeVisible();
  await expect(page.getByText("Fernanda Colaboradora")).toBeVisible();
  await expect(page.getByText(/Saldo: -2h 00min/)).toBeVisible();
  await expect(page.getByText(/Extras: —/)).toBeVisible();
});

test("shows an empty state when the team has no data", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request, { bancoDeHorasEquipe: [] });

  await page.goto("/banco-de-horas");

  await expect(page.getByRole("heading", { name: "Banco de Horas" })).toBeVisible();
  await expect(
    page.getByText("O saldo de banco de horas da equipe vai aparecer aqui."),
  ).toBeVisible();
});
