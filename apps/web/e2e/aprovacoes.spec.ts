import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi } from "./test-session";

test("colaborador sees a permission message instead of the queue", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/aprovacoes");

  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("lists pending atestados, vacation, adjustment and compensation requests for a gestor", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    atestados: [
      {
        id: "at-1",
        userName: "Carlos Colaborador",
        dias: 3,
        status: "enviado",
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
    vacations: [
      {
        id: "va-1",
        userName: "Diana Colaboradora",
        startDate: "2026-09-01",
        endDate: "2026-09-10",
        days: 9,
      },
    ],
    adjustments: [
      {
        id: "aj-1",
        userName: "Elias Colaborador",
        reason: "Esqueci de bater o ponto",
        createdAt: "2026-08-21T12:00:00.000Z",
      },
    ],
    compensations: [
      {
        id: "cp-1",
        userName: "Fabia Colaboradora",
        reason: "Compensar 2h",
        createdAt: "2026-08-22T12:00:00.000Z",
      },
    ],
  });

  await page.goto("/aprovacoes");

  await expect(page.getByText("Carlos Colaborador")).toBeVisible();
  await expect(page.getByText("Diana Colaboradora")).toBeVisible();
  await expect(page.getByText("Elias Colaborador")).toBeVisible();
  await expect(page.getByText("Fabia Colaboradora")).toBeVisible();
});

test("approving an adjustment request calls the API", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request, {
    adjustments: [
      {
        id: "aj-1",
        userName: "Elias Colaborador",
        reason: "Esqueci de bater o ponto",
        createdAt: "2026-08-21T12:00:00.000Z",
      },
    ],
  });

  await page.goto("/aprovacoes");
  await page
    .locator("li", { hasText: "Elias Colaborador" })
    .getByRole("button", { name: "Aprovar" })
    .click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "PATCH" && r.path === "/solicitacoes/ajustes/aj-1/status"
      )?.body;
    })
    .toEqual({ status: "aprovado" });
});

test("rejecting a compensation request calls the API", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request, {
    compensations: [
      {
        id: "cp-1",
        userName: "Fabia Colaboradora",
        reason: "Compensar 2h",
        createdAt: "2026-08-22T12:00:00.000Z",
      },
    ],
  });

  await page.goto("/aprovacoes");
  await page
    .locator("li", { hasText: "Fabia Colaboradora" })
    .getByRole("button", { name: "Recusar" })
    .click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "PATCH" && r.path === "/solicitacoes/compensacoes/cp-1/status"
      )?.body;
    })
    .toEqual({ status: "recusado" });
});

test("approving an atestado calls the API and refreshes the list", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    atestados: [
      {
        id: "at-1",
        userName: "Carlos Colaborador",
        dias: 3,
        status: "enviado",
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
  });

  await page.goto("/aprovacoes");
  await page
    .locator("li", { hasText: "Carlos Colaborador" })
    .getByRole("button", { name: "Aprovar" })
    .click();

  await expect(page.getByText("Carlos Colaborador")).toBeVisible();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "PATCH" && r.path === "/atestados/at-1/status"
      )?.body;
    })
    .toEqual({ status: "aprovado" });
});
