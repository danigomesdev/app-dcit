import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi, seedResponse } from "./test-session";

test.use({ timezoneId: "America/Sao_Paulo" });

// Some tests below seed GET /time-entries directly on the fake API server,
// which is shared, unreset state across the whole e2e run (workers: 1, no
// per-test server restart). Resetting after every test — not just before
// the ones that seed — keeps this file from leaking a seeded response into
// whichever spec file happens to run next (see historico.spec.ts's empty
// state test, which assumes a clean /time-entries with no seed of its own).
test.afterEach(async ({ request }) => {
  await mockApi(request);
});

test("gestor and rh see a permission message instead of the folha", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await page.goto("/folha");
  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("shows an empty state when no day has a punch on record", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/folha");
  await expect(page.getByRole("heading", { name: "Folha de ponto" })).toBeVisible();
  await expect(page.getByText("Nenhum dia registrado ainda.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Exportar PDF" })).toHaveCount(0);
});

test("groups punches by day and sums worked minutes per day, most recent day first", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);
  await seedResponse(request, {
    method: "GET",
    path: "/time-entries",
    response: [
      { id: "te-1", clockedAt: "2026-08-19T09:00:00-03:00" },
      { id: "te-2", clockedAt: "2026-08-19T11:00:00-03:00" },
      { id: "te-3", clockedAt: "2026-08-20T09:00:00-03:00" },
      { id: "te-4", clockedAt: "2026-08-20T13:30:00-03:00" },
    ],
  });

  await page.goto("/folha");

  const rows = page.locator("main ul > li");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("20 de agosto");
  await expect(rows.nth(0)).toContainText("4h 30min");
  await expect(rows.nth(1)).toContainText("19 de agosto");
  await expect(rows.nth(1)).toContainText("2h 00min");
});

test("credits an overnight shift's hours to the day it closes on, not the day it started", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  // Clock-in Aug 19 23:00 SP, clock-out Aug 20 01:00 SP — a 2-hour shift
  // crossing midnight. Grouping by day *before* pairing (the mobile app's
  // bug, and the punch card's pre-fix bug — see commit 8dc3fa1) would
  // strand the clock-in on Aug 19 and the clock-out on Aug 20, each
  // showing up unpaired instead of one completed 2-hour shift on Aug 20.
  await mockApi(request);
  await seedResponse(request, {
    method: "GET",
    path: "/time-entries",
    response: [
      { id: "te-in", clockedAt: "2026-08-19T23:00:00-03:00" },
      { id: "te-out", clockedAt: "2026-08-20T01:00:00-03:00" },
    ],
  });

  await page.goto("/folha");

  const rows = page.locator("main ul > li");
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toContainText("20 de agosto");
  await expect(rows.nth(0)).toContainText("2h 00min");
});

test("shows an open-shift day for a trailing unpaired punch", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);
  await seedResponse(request, {
    method: "GET",
    path: "/time-entries",
    response: [{ id: "te-open", clockedAt: "2026-08-20T09:00:00-03:00" }],
  });

  await page.goto("/folha");

  const rows = page.locator("main ul > li");
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toContainText("20 de agosto");
  await expect(rows.nth(0)).toContainText("0h 00min");
  await expect(rows.nth(0)).toContainText("ponto em aberto");
});

test("exports via window.print, and hides sidebar/topbar while printing", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);
  await seedResponse(request, {
    method: "GET",
    path: "/time-entries",
    response: [{ id: "te-1", clockedAt: "2026-08-20T09:00:00-03:00" }],
  });

  await page.addInitScript(() => {
    (window as unknown as { __printed: boolean }).__printed = false;
    window.print = () => {
      (window as unknown as { __printed: boolean }).__printed = true;
    };
  });

  await page.goto("/folha");
  await page.getByRole("button", { name: "Exportar PDF" }).click();

  const printed = await page.evaluate(() => (window as unknown as { __printed: boolean }).__printed);
  expect(printed).toBe(true);
});
