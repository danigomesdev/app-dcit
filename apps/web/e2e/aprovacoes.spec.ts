import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi } from "./test-session";

test("colaborador sees a permission message instead of the queue", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/aprovacoes");

  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("lists pending atestados and vacation requests for a gestor", async ({
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
  });

  await page.goto("/aprovacoes");

  await expect(page.getByText("Carlos Colaborador")).toBeVisible();
  await expect(page.getByText("Diana Colaboradora")).toBeVisible();
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
