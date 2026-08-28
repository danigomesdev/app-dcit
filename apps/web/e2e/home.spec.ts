import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi, seedResponse } from "./test-session";

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
        status: "trabalhando",
      },
      {
        userId: "colaborador-2",
        name: "Beto Colaborador",
        entries: [
          { id: "2", clockedAt: "2026-08-27T09:00:00.000Z" },
          { id: "3", clockedAt: "2026-08-27T13:00:00.000Z" },
        ],
        workedMinutes: 240,
        status: "pausa",
      },
    ],
  });

  await page.goto("/");

  await expect(page.getByText("Ana Colaboradora")).toBeVisible();
  await expect(page.getByText("Trabalhando", { exact: true })).toBeVisible();
  await expect(page.getByText("Beto Colaborador")).toBeVisible();
  await expect(page.getByText("Em pausa", { exact: true })).toBeVisible();
  await expect(page.getByText("4h 00min hoje")).toBeVisible();
});

test("shows the remaining statuses: atrasado, de folga, férias, atestado, não presente", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    team: [
      { userId: "u-1", name: "Atrasada", entries: [], workedMinutes: 0, status: "atrasado" },
      { userId: "u-2", name: "De Folga", entries: [], workedMinutes: 0, status: "folga" },
      {
        userId: "u-3",
        name: "De Férias",
        entries: [],
        workedMinutes: 0,
        status: "ferias",
        periodStart: "2026-08-25T00:00:00.000Z",
        periodEnd: "2026-08-29T00:00:00.000Z",
      },
      {
        userId: "u-4",
        name: "De Atestado",
        entries: [],
        workedMinutes: 0,
        status: "atestado",
        periodStart: "2026-08-26T00:00:00.000Z",
        periodEnd: "2026-08-28T00:00:00.000Z",
      },
      { userId: "u-5", name: "Encerrou o Dia", entries: [], workedMinutes: 480, status: "nao_presente" },
    ],
  });

  await page.goto("/");

  await expect(page.getByText("Atrasado", { exact: true })).toBeVisible();
  await expect(page.getByText("De folga", { exact: true })).toBeVisible();
  await expect(page.getByText("Férias", { exact: true })).toBeVisible();
  await expect(page.getByText("25/08/2026 até 29/08/2026")).toBeVisible();
  await expect(page.getByText("Atestado", { exact: true })).toBeVisible();
  await expect(page.getByText("26/08/2026 até 28/08/2026")).toBeVisible();
  await expect(page.getByText("Não presente", { exact: true })).toBeVisible();
});

test("polls for updates and re-renders with the new data after 60s", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    team: [{ userId: "u-1", name: "Ana", entries: [], workedMinutes: 0, status: "sem_registro" }],
  });

  await page.clock.install();
  await page.goto("/");
  await expect(page.getByText("Sem registro", { exact: true })).toBeVisible();

  await seedResponse(request, {
    method: "GET",
    path: "/time-entries/team",
    response: [{ userId: "u-1", name: "Ana", entries: [], workedMinutes: 0, status: "trabalhando" }],
  });
  await page.clock.runFor(60_000);

  await expect(page.getByText("Trabalhando", { exact: true })).toBeVisible();
});

test("keeps showing the last known data when a poll fails", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request, {
    team: [{ userId: "u-1", name: "Ana", entries: [], workedMinutes: 0, status: "trabalhando" }],
  });

  await page.clock.install();
  await page.goto("/");
  await expect(page.getByText("Trabalhando", { exact: true })).toBeVisible();

  await seedResponse(request, {
    method: "GET",
    path: "/time-entries/team",
    status: 500,
    response: { message: "Internal server error" },
  });

  const failedPoll = page.waitForResponse(
    (res) => res.url().includes("/api/team-presence") && res.status() === 500
  );
  await page.clock.runFor(60_000);
  await failedPoll;

  // The failed poll must not clear or blank the panel.
  await expect(page.getByText("Ana")).toBeVisible();
  await expect(page.getByText("Trabalhando", { exact: true })).toBeVisible();
});
