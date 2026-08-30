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
  await expect(page.getByText(/Valor-hora: —/)).toBeVisible();
  await expect(page.getByText(/Saldo: -2h 00min/)).toBeVisible();
  await expect(page.getByText(/Extras: —/)).toBeVisible();
});

test("shows the hourly rate when the colaborador has a salário on file", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    bancoDeHorasEquipe: [
      {
        userId: "user-1",
        userName: "Com Convênio",
        balanceMinutes: 120,
        dsrMinutes: 240,
        hourlyRateBRL: 45.45,
        overtimeValueBRL: 90.9,
      },
    ],
  });

  await page.goto("/banco-de-horas");

  await expect(page.getByText(/Valor-hora: R\$\s?45,45/)).toBeVisible();
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

test("the current month has no next-month link", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request, {
    bancoDeHorasEquipe: [
      {
        userId: "user-1",
        userName: "Ana",
        balanceMinutes: 0,
        dsrMinutes: 0,
        hourlyRateBRL: null,
        overtimeValueBRL: null,
      },
    ],
  });

  await page.goto("/banco-de-horas");

  await expect(page.getByRole("link", { name: "← Mês anterior" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Próximo mês →" })).toHaveCount(0);
});

test("month navigation moves between periods and re-enables the next-month link on a past month", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    bancoDeHorasEquipe: [
      {
        userId: "user-1",
        userName: "Ana",
        balanceMinutes: 0,
        dsrMinutes: 0,
        hourlyRateBRL: null,
        overtimeValueBRL: null,
      },
    ],
  });

  await page.goto("/banco-de-horas?start=2026-01-15");
  await expect(page.getByText(/Saldo de janeiro de 2026/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Próximo mês →" })).toBeVisible();

  await page.getByRole("link", { name: "Próximo mês →" }).click();
  await expect(page).toHaveURL(/start=2026-02-01/);
  await expect(page.getByText(/Saldo de fevereiro de 2026/i)).toBeVisible();
});
