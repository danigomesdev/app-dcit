import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi, seedResponse } from "./test-session";

test.use({ timezoneId: "America/Sao_Paulo" });

// Same reasoning as apps/web/src/app/(app)/page.tsx's dateOnlyInSaoPaulo:
// compute calendar dates via Intl with an explicit America/Sao_Paulo
// timeZone, never via UTC slicing, so this helper doesn't drift with
// whatever timezone happens to run the test.
function saoPauloDateString(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

test("colaborador bate o ponto e vê o horário e as horas trabalhadas", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });

  // Real "today" (São Paulo), not a hardcoded past date: the punch card now
  // filters every entry (freshly punched ones included) against today's
  // actual date, so a fixture date from the past would never match.
  const spToday = saoPauloDateString(new Date());

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sem permissão" })).toHaveCount(0);
  await expect(page.getByText("Último ponto: --:--")).toBeVisible();
  await expect(page.getByText("Horas trabalhadas hoje: 0h 00min")).toBeVisible();

  await seedResponse(request, {
    method: "POST",
    path: "/time-entries",
    status: 201,
    response: { id: "te-1", clockedAt: `${spToday}T09:00:00-03:00` },
  });
  await page.getByRole("button", { name: "Bater Ponto" }).click();
  await expect(page.getByText("Último ponto: 09:00")).toBeVisible();
  await expect(page.getByText("Horas trabalhadas hoje: 0h 00min")).toBeVisible();

  await seedResponse(request, {
    method: "POST",
    path: "/time-entries",
    status: 201,
    response: { id: "te-2", clockedAt: `${spToday}T10:30:00-03:00` },
  });
  await page.getByRole("button", { name: "Bater Ponto" }).click();
  await expect(page.getByText("Último ponto: 10:30")).toBeVisible();
  await expect(page.getByText("Horas trabalhadas hoje: 1h 30min")).toBeVisible();
});

test("gestor keeps seeing the team presence panel at /, not the punch card", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await mockApi(request);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Bater Ponto" })).toHaveCount(0);
  // Positive check: the actual PresencePanel (team view, empty state since
  // mockApi() with no team seeds GET /time-entries/team -> []) rendered,
  // rather than e.g. a generic error page which also has no "Bater Ponto"
  // button and would otherwise make the check above pass vacuously.
  await expect(page.getByRole("heading", { name: "Ponto dos funcionários" })).toBeVisible();
});

test("shows a fallback when location isn't available", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/");
  // The default Playwright browser context has no geolocation permission
  // granted, so the browser's geolocation API errors out immediately.
  await expect(page.getByText("Localização não disponível")).toBeVisible();
});

test("shows a late-night punch as today's, not tomorrow's UTC date", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);

  // 23:30 São Paulo time converts to a UTC instant on the *next* calendar
  // day (SP is UTC-3). A UTC-naive `.toISOString().slice(0, 10)` read of
  // "today" would exclude this entry from "today" entirely, falling back
  // to "Último ponto: --:--" — this fails under that regression and passes
  // under the current São-Paulo-aware dateOnlyInSaoPaulo logic.
  const now = new Date();
  const spToday = saoPauloDateString(now);
  const lateNightEntryIso = `${spToday}T23:30:00-03:00`;

  await seedResponse(request, {
    method: "GET",
    path: "/time-entries",
    response: [{ id: "te-late-sp", clockedAt: lateNightEntryIso }],
  });

  await page.goto("/");

  const expectedLastPunch = new Date(lateNightEntryIso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  await expect(page.getByText(`Último ponto: ${expectedLastPunch}`)).toBeVisible();
  // A single, unpaired entry — no completed shift yet, so no minutes.
  await expect(page.getByText("Horas trabalhadas hoje: 0h 00min")).toBeVisible();
});

test("pairs an overnight shift across midnight instead of stranding the clock-in", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);

  // Clock-in yesterday 23:00 SP, clock-out today 01:00 SP — a 2-hour shift
  // that crosses midnight. Entries alternate clock-in/out over the whole
  // history, not per calendar day, so pairing must span the boundary: if
  // "today" were filtered before pairing (the pre-fix behavior), the
  // clock-in would be dropped for being "yesterday", leaving the clock-out
  // looking like an unpaired, still-open punch with 0 worked minutes.
  const now = new Date();
  const spToday = saoPauloDateString(now);
  const spYesterday = saoPauloDateString(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const clockInIso = `${spYesterday}T23:00:00-03:00`;
  const clockOutIso = `${spToday}T01:00:00-03:00`;

  await seedResponse(request, {
    method: "GET",
    path: "/time-entries",
    response: [
      { id: "te-overnight-in", clockedAt: clockInIso },
      { id: "te-overnight-out", clockedAt: clockOutIso },
    ],
  });

  await page.goto("/");

  const expectedLastPunch = new Date(clockOutIso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  // The shift closes today, so its 2 hours are credited to today.
  await expect(page.getByText(`Último ponto: ${expectedLastPunch}`)).toBeVisible();
  await expect(page.getByText("Horas trabalhadas hoje: 2h 00min")).toBeVisible();
});
