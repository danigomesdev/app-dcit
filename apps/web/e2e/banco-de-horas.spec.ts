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

test("colaborador's period tabs switch between mês atual, anterior and últimos 3 meses, keeping the saldo aligned to calendar months", async ({
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
  // "Mês atual" is the default period, so it starts out visually active.
  await expect(atual).toHaveClass(/periodTabActive/);

  const getMinhasQueries = async () => {
    const recorded = await getRecordedRequests(request);
    return recorded
      .filter((r) => r.method === "GET" && r.path === "/banco-de-horas/minhas")
      .map((r) => r.query);
  };

  await tresMeses.click();
  await expect(page).toHaveURL(/periodo=3meses/);
  await expect(tresMeses).toHaveClass(/periodTabActive/);
  await expect(atual).not.toHaveClass(/periodTabActive/);

  await anterior.click();
  await expect(page).toHaveURL(/periodo=anterior/);
  await expect(anterior).toHaveClass(/periodTabActive/);
  await expect(tresMeses).not.toHaveClass(/periodTabActive/);

  // Wait for all three GET /banco-de-horas/minhas requests (initial load +
  // the two tab clicks) to land, then check the calendar-alignment
  // invariant on their recorded start/end query params: the saldo must
  // always be a fixed calendar-month window, never a rolling window that
  // happens to slide with "today".
  await expect.poll(async () => (await getMinhasQueries()).length).toBe(3);
  const [atualQuery, tresMesesQuery, anteriorQuery] = await getMinhasQueries();

  // Every period's start is the 1st of a month, not an arbitrary rolling
  // cutoff N days back from today.
  expect(atualQuery.start.endsWith("-01")).toBe(true);
  expect(tresMesesQuery.start.endsWith("-01")).toBe(true);
  expect(anteriorQuery.start.endsWith("-01")).toBe(true);

  // "Mês anterior" never crosses into a second calendar month — a rolling
  // 30-day window from today would fail this on most days of the month.
  expect(anteriorQuery.end.slice(0, 7)).toBe(anteriorQuery.start.slice(0, 7));

  // Each period starts strictly earlier than the next, and "3 meses" starts
  // two calendar months before "mês atual" — i.e. before "mês anterior".
  expect(anteriorQuery.start < atualQuery.start).toBe(true);
  expect(tresMesesQuery.start < anteriorQuery.start).toBe(true);

  // "3 meses" ends today, same as "mês atual" — only its start reaches back
  // further, confirming it's still anchored to "today", not open-ended.
  expect(tresMesesQuery.end).toBe(atualQuery.end);
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

test("submitting the compensation form posts the reason to the API and refreshes Minhas solicitações with the new item", async ({
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
  await expect(page.getByText("Nenhuma solicitação registrada ainda.")).toBeVisible();

  // Re-seed the GET *before* submitting, so it's already in place when the
  // form's server action (requestCompensation) calls revalidatePath and the
  // page re-fetches "Minhas solicitações" as part of that same round trip —
  // this is what proves revalidatePath actually refreshes the list, not
  // just that the POST body was correct.
  await seedResponse(request, {
    method: "GET",
    path: "/solicitacoes/compensacoes",
    response: [
      {
        id: "cp-new",
        reason: "Compensar plantão de sábado",
        status: "pendente",
        reviewNote: null,
        createdAt: "2026-08-31T12:00:00.000Z",
      },
    ],
  });

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

  await expect(page.getByText("Compensar plantão de sábado")).toBeVisible();
  await expect(page.getByText("Pendente")).toBeVisible();
  await expect(page.getByText("Nenhuma solicitação registrada ainda.")).toHaveCount(0);
});
