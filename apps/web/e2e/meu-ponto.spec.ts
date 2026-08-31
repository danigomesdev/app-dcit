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

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sem permissão" })).toHaveCount(0);
  await expect(page.getByText("Último ponto: --:--")).toBeVisible();
  await expect(page.getByText("Horas trabalhadas hoje: 0h 00min")).toBeVisible();

  await seedResponse(request, {
    method: "POST",
    path: "/time-entries",
    status: 201,
    response: { id: "te-1", clockedAt: "2026-08-20T12:00:00.000Z" },
  });
  await page.getByRole("button", { name: "Bater Ponto" }).click();
  await expect(page.getByText("Último ponto: 09:00")).toBeVisible();
  await expect(page.getByText("Horas trabalhadas hoje: 0h 00min")).toBeVisible();

  await seedResponse(request, {
    method: "POST",
    path: "/time-entries",
    status: 201,
    response: { id: "te-2", clockedAt: "2026-08-20T13:30:00.000Z" },
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

test("only counts today's entries in São Paulo time, not a UTC calendar day", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);

  // Chosen so that a UTC-naive `new Date().toISOString().slice(0, 10)`
  // implementation of "today" disagrees with the São-Paulo-aware one no
  // matter what wall-clock time this test happens to run at:
  //   - todayEntry sits at noon SP time -> its UTC date-slice is also
  //     spToday (SP is UTC-3, so +3h never crosses a UTC day boundary).
  //   - yesterdayEntry sits at 23:00 SP time on spYesterday -> converted to
  //     UTC that's 02:00 the next day, i.e. also spToday's UTC date-slice.
  // So both entries land on the same UTC calendar day (spToday), but only
  // one of them is actually "today" in São Paulo. A UTC-naive filter would
  // either include both (when the real UTC day equals spToday) or exclude
  // both (in the UTC 00:00-02:59 window, when the real UTC day is
  // spToday + 1) -- either way it disagrees with the correct SP-aware
  // result of "only todayEntry counts", so the assertions below fail under
  // a regression and pass under the current dateOnlyInSaoPaulo logic.
  const now = new Date();
  const spToday = saoPauloDateString(now);
  const spYesterday = saoPauloDateString(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const todayEntryIso = `${spToday}T12:00:00-03:00`;
  const yesterdayEntryIso = `${spYesterday}T23:00:00-03:00`;

  await seedResponse(request, {
    method: "GET",
    path: "/time-entries",
    response: [
      { id: "te-yesterday-sp", clockedAt: yesterdayEntryIso },
      { id: "te-today-sp", clockedAt: todayEntryIso },
    ],
  });

  await page.goto("/");

  const expectedLastPunch = new Date(todayEntryIso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  // Only the SP-today entry should be counted: it's the sole entry, so
  // "Último ponto" reflects it and "Horas trabalhadas hoje" is 0 (no pair
  // to sum). If the yesterday entry were wrongly included too, they'd pair
  // up into a large non-zero worked-time; if both were wrongly excluded,
  // "Último ponto" would fall back to "--:--".
  await expect(page.getByText(`Último ponto: ${expectedLastPunch}`)).toBeVisible();
  await expect(page.getByText("Horas trabalhadas hoje: 0h 00min")).toBeVisible();
});
