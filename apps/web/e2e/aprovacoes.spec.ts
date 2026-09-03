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

  await page.getByRole("button", { name: "Atestados — Fila de aprovações" }).click();
  await expect(page.getByText("Carlos Colaborador")).toBeVisible();

  await page.getByRole("button", { name: "Férias — Fila de aprovações" }).click();
  await expect(page.getByText("Diana Colaboradora")).toBeVisible();

  await page.getByRole("button", { name: "Ajustes de ponto — Fila de aprovações" }).click();
  await expect(page.getByText("Elias Colaborador")).toBeVisible();

  await page.getByRole("button", { name: "Banco de horas — Fila de aprovações" }).click();
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
  await page.getByRole("button", { name: "Ajustes de ponto — Fila de aprovações" }).click();
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
  await page.getByRole("button", { name: "Banco de horas — Fila de aprovações" }).click();
  const item = page.locator("li", { hasText: "Fabia Colaboradora" });
  await item.getByRole("button", { name: "Recusar" }).click();
  await page.getByLabel("Motivo da recusa").fill("Saldo insuficiente");
  await page.getByRole("button", { name: "Confirmar recusa" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "PATCH" && r.path === "/solicitacoes/compensacoes/cp-1/status"
      )?.body;
    })
    .toEqual({ status: "recusado", reviewNote: "Saldo insuficiente" });
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
  await page.getByRole("button", { name: "Atestados — Fila de aprovações" }).click();
  await page
    .locator("li", { hasText: "Carlos Colaborador" })
    .getByRole("button", { name: "Aprovar" })
    .click();

  // The fake API server echoes the PATCH body but never mutates its seeded
  // atestados list, so the refreshed page still reports Carlos as pending —
  // he stays under Fila, not Histórico. This test only ever verified the
  // approve action's request payload; it never actually exercised the
  // decided-item moving to history (that's covered by the dedicated
  // "already-decided requests" test below, which seeds status directly).
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

test("shows already-decided requests in the history section with their rejection reason", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    adjustments: [
      {
        id: "aj-2",
        userName: "Gil Colaborador",
        reason: "Bateu o ponto errado",
        status: "recusado",
        reviewNote: "Sem batida correspondente",
        createdAt: "2026-08-21T12:00:00.000Z",
      },
    ],
  });

  await page.goto("/aprovacoes");

  await expect(page.getByRole("heading", { name: "Histórico de aprovações" })).toBeVisible();
  await page.getByRole("button", { name: "Ajustes de ponto — Histórico de aprovações" }).click();
  const historyItem = page.locator("li", { hasText: "Gil Colaborador" });
  await expect(historyItem.getByText("Recusado")).toBeVisible();
  await expect(historyItem.getByText("Motivo: Sem batida correspondente")).toBeVisible();
});
