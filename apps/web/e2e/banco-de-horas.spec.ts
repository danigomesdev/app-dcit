import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi, seedResponse } from "./test-session";

test("colaborador sees their own saldo, DSR, and daily breakdown for the current month", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    bancoDeHorasMinhas: {
      days: [
        { date: "2026-08-01", expectedMinutes: 480, workedMinutes: 480, diffMinutes: 0 },
        { date: "2026-08-02", expectedMinutes: 480, workedMinutes: 420, diffMinutes: -60 },
      ],
      // -75 (summary) deliberately differs from any per-day diffMinutes
      // (0, -60) so the two "-1h Xmin"-shaped strings can't collide under
      // Playwright's strict-mode text matching.
      balanceMinutes: -75,
      dsrMinutes: 0,
      hourlyRateBRL: 45.45,
      overtimeValueBRL: null,
    },
    myCompensations: [],
  });

  await page.goto("/banco-de-horas");

  await expect(page.getByRole("heading", { name: "Banco de Horas" })).toBeVisible();
  await expect(page.getByText("-1h 15min")).toBeVisible();
  await expect(page.getByText(/R\$\s?45,45/)).toBeVisible();

  // Both days share "Previsto: 8h 00min" (same expectedMinutes) — scope to
  // one row via its unique date label instead of asserting on page-wide text.
  const row = page.locator("li", { hasText: "02/08" });
  await expect(row).toContainText("Previsto: 8h 00min");
  await expect(row).toContainText("Trabalhado: 7h 00min");
  await expect(row).toContainText("Diferença: -1h 00min");
});

test("colaborador's period tabs switch between mês atual, anterior and últimos 3 meses", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    bancoDeHorasMinhas: {
      days: [],
      balanceMinutes: 0,
      dsrMinutes: 0,
      hourlyRateBRL: null,
      overtimeValueBRL: null,
    },
    myCompensations: [],
  });

  await page.goto("/banco-de-horas");

  const atual = page.getByRole("link", { name: "Mês atual" });
  const anterior = page.getByRole("link", { name: "Mês anterior" });
  const tresMeses = page.getByRole("link", { name: "Últimos 3 meses" });
  await expect(atual).toBeVisible();
  await expect(anterior).toBeVisible();
  await expect(tresMeses).toBeVisible();

  await tresMeses.click();
  await expect(page).toHaveURL(/periodo=3meses/);

  await anterior.click();
  await expect(page).toHaveURL(/periodo=anterior/);
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

test("colaborador sees their own compensation requests, including the reviewer's note on a recusado one", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    bancoDeHorasMinhas: {
      days: [],
      balanceMinutes: 0,
      dsrMinutes: 0,
      hourlyRateBRL: null,
      overtimeValueBRL: null,
    },
    myCompensations: [
      {
        id: "cp-1",
        reason: "Compensar 2h de plantão",
        status: "recusado",
        reviewNote: "Saldo insuficiente",
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
  });

  await page.goto("/banco-de-horas");

  await expect(page.getByText("Compensar 2h de plantão")).toBeVisible();
  await expect(page.getByText("Recusado")).toBeVisible();
  await expect(page.getByText("Saldo insuficiente")).toBeVisible();
});

test("shows a message when there are no compensation requests yet", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    bancoDeHorasMinhas: {
      days: [],
      balanceMinutes: 0,
      dsrMinutes: 0,
      hourlyRateBRL: null,
      overtimeValueBRL: null,
    },
    myCompensations: [],
  });

  await page.goto("/banco-de-horas");

  await expect(page.getByText("Nenhuma solicitação registrada ainda.")).toBeVisible();
});

test("submitting the compensation form posts the reason to the API", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    bancoDeHorasMinhas: {
      days: [],
      balanceMinutes: 0,
      dsrMinutes: 0,
      hourlyRateBRL: null,
      overtimeValueBRL: null,
    },
    myCompensations: [],
  });
  await seedResponse(request, {
    method: "POST",
    path: "/solicitacoes/compensacoes",
    status: 201,
    response: { id: "cp-new", reason: "Compensar plantão de sábado", status: "pendente" },
  });

  await page.goto("/banco-de-horas");
  await page.getByLabel("Motivo").fill("Compensar plantão de sábado");
  await page.getByRole("button", { name: "Enviar solicitação" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "POST" && r.path === "/solicitacoes/compensacoes",
      )?.body;
    })
    .toEqual({ reason: "Compensar plantão de sábado" });
});
