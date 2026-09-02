import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi, seedResponse } from "./test-session";

// Local helpers mirroring apps/web/src/app/(app)/ferias/page.tsx's own
// date-only cycle math, used to compute the expected período
// aquisitivo/vencimento from a hireDate without hardcoding "today" — the
// page always shows the real current cycle, so the test derives its
// expectation from the actual run date instead of a fixed calendar date.
function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

// São-Paulo-aware "today", mirroring the page's own todaySaoPauloDateOnly —
// deliberately not a timezone-naive `new Date()` read, since the test
// runner's local timezone isn't guaranteed to be America/Sao_Paulo and the
// page always renders "today" anchored to that timezone.
function todaySaoPauloDateOnly(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addYearsToDateOnly(dateStr: string, years: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${(year + years).toString().padStart(4, "0")}-${pad(month)}-${pad(day)}`;
}

function currentCycle(hireDate: string, today: string) {
  let n = 0;
  while (addYearsToDateOnly(hireDate, n + 2) <= today) n++;
  return {
    aquisitivoInicio: addYearsToDateOnly(hireDate, n),
    aquisitivoFim: addYearsToDateOnly(hireDate, n + 1),
    vencimento: addYearsToDateOnly(hireDate, n + 2),
  };
}

function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

// A fixed, always-in-the-past hireDate — stable regardless of when the
// test suite runs, since currentCycle() walks it forward to whichever
// cycle contains "today". Kept as a bare YYYY-MM-DD value because that's
// the internal date-only representation the page's own cycle math (and
// this file's mirrored currentCycle helper) computes with.
const HIRE_DATE = "2020-03-10";

// What the API actually sends over the wire: hireDate is a Prisma
// DateTime column, serialized as a full ISO instant string, not a bare
// date. Use this (not HIRE_DATE) whenever seeding feriasData/mockApi
// responses, so the fixtures match reality instead of the bug that let
// this ship — HIRE_DATE itself stays bare for the test's own expected-
// value math above.
const HIRE_DATE_ISO = `${HIRE_DATE}T00:00:00.000Z`;

test("gestor and rh see a permission message instead of the vacation page", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await page.goto("/ferias");
  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();

  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await page.goto("/ferias");
  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("colaborador sees the illustrative saldo, período aquisitivo and vencimento", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    feriasData: { requests: [], hireDate: HIRE_DATE_ISO, history: [] },
  });

  await page.goto("/ferias");

  const today = todaySaoPauloDateOnly();
  const cycle = currentCycle(HIRE_DATE, today);

  await expect(page.getByRole("heading", { name: "Férias", exact: true, level: 1 })).toBeVisible();
  await expect(page.getByText("22 dias disponíveis")).toBeVisible();
  await expect(
    page.getByText(
      `Período aquisitivo: ${formatDateBR(cycle.aquisitivoInicio)} — ${formatDateBR(cycle.aquisitivoFim)}`,
    ),
  ).toBeVisible();
  await expect(page.getByText(`Vencem em ${formatDateBR(cycle.vencimento)}`)).toBeVisible();
});

test("shows the vencimento alert when it's within 90 days", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  const target = new Date();
  target.setDate(target.getDate() + 30);
  const hireDate = `${target.getFullYear() - 2}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
  await mockApi(request, {
    feriasData: { requests: [], hireDate: `${hireDate}T00:00:00.000Z`, history: [] },
  });

  await page.goto("/ferias");

  await expect(page.getByText(/Suas férias vencem em \d+ dias\./)).toBeVisible();
});

test("does not show the vencimento alert when it's far away", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  const target = new Date();
  target.setDate(target.getDate() + 400);
  const hireDate = `${target.getFullYear() - 2}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
  await mockApi(request, {
    feriasData: { requests: [], hireDate: `${hireDate}T00:00:00.000Z`, history: [] },
  });

  await page.goto("/ferias");

  await expect(page.getByText(/Suas férias vencem em \d+ dias\./)).toHaveCount(0);
});

test("colaborador sees their own vacation requests, including the reviewer's note on a recusado one", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    feriasData: {
      requests: [
        {
          id: "vr-1",
          startDate: "2026-07-10T00:00:00.000Z",
          endDate: "2026-07-24T00:00:00.000Z",
          days: 15,
          status: "aprovado",
          reviewNote: null,
        },
        {
          id: "vr-2",
          startDate: "2026-01-05T00:00:00.000Z",
          endDate: "2026-01-09T00:00:00.000Z",
          days: 5,
          status: "recusado",
          reviewNote: "Período coincide com o fechamento mensal do financeiro.",
        },
      ],
      hireDate: HIRE_DATE_ISO,
      history: [],
    },
  });

  await page.goto("/ferias");

  await expect(page.getByText("10/07/2026 — 24/07/2026")).toBeVisible();
  await expect(page.getByText("15 dia(s)")).toBeVisible();
  await expect(page.getByText("Aprovado")).toBeVisible();

  await expect(page.getByText("05/01/2026 — 09/01/2026")).toBeVisible();
  await expect(page.getByText("Recusado")).toBeVisible();
  await expect(
    page.getByText("Período coincide com o fechamento mensal do financeiro."),
  ).toBeVisible();
});

test("shows a message when there are no vacation requests yet", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    feriasData: { requests: [], hireDate: HIRE_DATE_ISO, history: [] },
  });

  await page.goto("/ferias");

  await expect(page.getByText("Nenhuma solicitação registrada ainda.")).toBeVisible();
});

test("colaborador sees their vacation history", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    feriasData: {
      requests: [],
      hireDate: HIRE_DATE_ISO,
      history: [
        {
          id: "vh-1",
          year: 2025,
          startDate: "2025-06-15T00:00:00.000Z",
          endDate: "2025-06-29T00:00:00.000Z",
          daysTaken: 15,
        },
        {
          id: "vh-2",
          year: 2024,
          startDate: "2024-01-10T00:00:00.000Z",
          endDate: "2024-02-09T00:00:00.000Z",
          daysTaken: 30,
        },
      ],
    },
  });

  await page.goto("/ferias");

  // Check for the history section heading
  await expect(page.getByRole("heading", { name: "Histórico de férias" })).toBeVisible();
  // Check for the 2025 entry with its full date range
  await expect(page.getByText("15/06/2025 — 29/06/2025 · 15 dias")).toBeVisible();
  // Check for the 2024 entry with its full date range
  await expect(page.getByText("10/01/2024 — 09/02/2024 · 30 dias")).toBeVisible();
});

test("shows a message when there's no vacation history yet", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    feriasData: { requests: [], hireDate: HIRE_DATE_ISO, history: [] },
  });

  await page.goto("/ferias");

  await expect(page.getByText("Nenhum período de férias registrado ainda.")).toBeVisible();
});

test("submitting the vacation form posts start/end/days to the API and refreshes Minhas solicitações with the new item", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    feriasData: { requests: [], hireDate: HIRE_DATE_ISO, history: [] },
  });
  await seedResponse(request, {
    method: "POST",
    path: "/solicitacoes/ferias",
    status: 201,
    response: {
      id: "vr-new",
      startDate: "2026-12-15T00:00:00.000Z",
      endDate: "2027-01-05T00:00:00.000Z",
      days: 22,
      status: "pendente",
      reviewNote: null,
    },
  });

  await page.goto("/ferias");
  await expect(page.getByText("Nenhuma solicitação registrada ainda.")).toBeVisible();

  // Re-seed the GET *before* submitting, so it's already in place when the
  // form's server action (requestVacation) calls revalidatePath and the
  // page re-fetches as part of that same round trip — this is what proves
  // revalidatePath actually refreshes the list, not just that the POST
  // body was correct.
  await seedResponse(request, {
    method: "GET",
    path: "/solicitacoes/ferias",
    response: {
      requests: [
        {
          id: "vr-new",
          startDate: "2026-12-15T00:00:00.000Z",
          endDate: "2027-01-05T00:00:00.000Z",
          days: 22,
          status: "pendente",
          reviewNote: null,
        },
      ],
      hireDate: HIRE_DATE_ISO,
      history: [],
    },
  });

  await page.getByLabel("Início").fill("2026-12-15");
  await page.getByLabel("Fim").fill("2027-01-05");
  await page.getByRole("button", { name: "Enviar solicitação" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/solicitacoes/ferias")?.body;
    })
    .toEqual({ startDate: "2026-12-15", endDate: "2027-01-05", days: 22 });

  await expect(page.getByText("15/12/2026 — 05/01/2027")).toBeVisible();
  await expect(page.getByText("22 dia(s)")).toBeVisible();
  await expect(page.getByText("Pendente")).toBeVisible();
  await expect(page.getByText("Nenhuma solicitação registrada ainda.")).toHaveCount(0);
});
