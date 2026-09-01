import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi } from "./test-session";

// Local helpers mirroring apps/web/src/app/(app)/ferias/page.tsx's own
// date-only cycle math, used to compute the expected período
// aquisitivo/vencimento from a hireDate without hardcoding "today" — the
// page always shows the real current cycle, so the test derives its
// expectation from the actual run date instead of a fixed calendar date.
function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toDateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
// cycle contains "today".
const HIRE_DATE = "2020-03-10";

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
    feriasData: { requests: [], hireDate: HIRE_DATE, history: [] },
  });

  await page.goto("/ferias");

  const today = toDateOnly(new Date());
  const cycle = currentCycle(HIRE_DATE, today);

  await expect(page.getByRole("heading", { name: "Férias" })).toBeVisible();
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
    feriasData: { requests: [], hireDate, history: [] },
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
    feriasData: { requests: [], hireDate, history: [] },
  });

  await page.goto("/ferias");

  await expect(page.getByText(/Suas férias vencem em \d+ dias\./)).toHaveCount(0);
});
