import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi, seedResponse } from "./test-session";

test("colaborador and gestor see a permission message; rh sees the categories", async ({
  page,
  context,
  request,
}) => {
  await mockApi(request, { employees: [] });

  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/pagamentos");
  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();

  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await page.goto("/pagamentos");
  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();

  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await page.goto("/pagamentos");
  await expect(page.getByRole("heading", { name: "Pagamentos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Salário" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Auxílio Home Office" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Vale Transporte" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Vale Alimentação" })).toBeVisible();
});

test("expanding a category shows colaboradores with 'Não enviado' when there's no status yet", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [
      { userId: "user-1", name: "Diana Colaboradora", role: "colaborador", team: "SGN360" },
      { userId: "user-2", name: "Elias Gestor", role: "gestor", team: null },
    ],
  });

  await page.goto("/pagamentos");
  await page.getByRole("button", { name: "Salário" }).click();

  await expect(page.getByText("Diana Colaboradora")).toBeVisible();
  await expect(page.getByText("Não enviado")).toBeVisible();
  // gestor accounts are never shown — only role: "colaborador"
  await expect(page.getByText("Elias Gestor")).toHaveCount(0);
});

test("shows 'Enviado em' with the most recent date when the status endpoint has an entry", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [{ userId: "user-1", name: "Diana Colaboradora", role: "colaborador", team: "SGN360" }],
  });
  await seedResponse(request, {
    method: "GET",
    path: "/notifications/pagamentos/status/salario",
    response: [{ userId: "user-1", sentAt: "2026-09-05T12:00:00.000Z" }],
  });

  await page.goto("/pagamentos");
  await page.getByRole("button", { name: "Salário" }).click();

  await expect(page.getByText("Enviado em 05/09/2026")).toBeVisible();
});

test("filters the list by name", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [
      { userId: "user-1", name: "Diana Colaboradora", role: "colaborador", team: null },
      { userId: "user-2", name: "Fabio Colaborador", role: "colaborador", team: null },
    ],
  });

  await page.goto("/pagamentos");
  await page.getByRole("button", { name: "Salário" }).click();
  await page.getByLabel("Buscar colaborador em Salário").fill("diana");

  await expect(page.getByText("Diana Colaboradora")).toBeVisible();
  await expect(page.getByText("Fabio Colaborador")).toHaveCount(0);
});

test("filters the list by team", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [
      { userId: "user-1", name: "Diana Colaboradora", role: "colaborador", team: "SGN360" },
      { userId: "user-2", name: "Fabio Colaborador", role: "colaborador", team: "SGM365" },
      { userId: "user-3", name: "Gabriela Colaboradora", role: "colaborador", team: null },
    ],
  });

  await page.goto("/pagamentos");
  await page.getByRole("button", { name: "Salário" }).click();
  await page.getByLabel("Filtrar por time em Salário").selectOption("SGN360");

  await expect(page.getByText("Diana Colaboradora")).toBeVisible();
  await expect(page.getByText("Fabio Colaborador")).toHaveCount(0);
  await expect(page.getByText("Gabriela Colaboradora")).toHaveCount(0);
});

test("shows a message when no colaborador matches the filter", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [{ userId: "user-1", name: "Diana Colaboradora", role: "colaborador", team: null }],
  });

  await page.goto("/pagamentos");
  await page.getByRole("button", { name: "Salário" }).click();
  await page.getByLabel("Buscar colaborador em Salário").fill("zzz");

  await expect(page.getByText("Nenhum colaborador encontrado.")).toBeVisible();
});

test("sends an individual notification and the row updates to 'Enviado'", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [{ userId: "user-1", name: "Diana Colaboradora", role: "colaborador", team: null }],
  });
  await seedResponse(request, {
    method: "POST",
    path: "/notifications/pagamentos",
    status: 201,
    response: { sent: 1 },
  });

  await page.goto("/pagamentos");
  await page.getByRole("button", { name: "Salário" }).click();
  // exact: true — plain "Enviar" is otherwise a substring match of the
  // "Enviar para todos (N)" bulk button, which is also visible here.
  await expect(page.getByRole("button", { name: "Enviar", exact: true })).toBeVisible();

  // A Server Action that calls revalidatePath re-renders the current route
  // server-side within the SAME HTTP round-trip as the action itself (see
  // node_modules/next/dist/docs/01-app/02-guides/server-actions.md, "A
  // single response carries data and UI"). So the fake API's post-send
  // status must be seeded *before* the click — the bundled re-render's GET
  // to the status endpoint fires as part of that click, before this test
  // would otherwise get a chance to seed it afterward.
  await seedResponse(request, {
    method: "GET",
    path: "/notifications/pagamentos/status/salario",
    response: [{ userId: "user-1", sentAt: "2026-09-01T12:00:00.000Z" }],
  });

  await page.getByRole("button", { name: "Enviar", exact: true }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/notifications/pagamentos")?.body;
    })
    .toEqual({ category: "salario", userIds: ["user-1"] });

  await expect(page.getByRole("button", { name: "Reenviar" })).toBeVisible();
});

test("'Enviar para todos' sends only the currently filtered userIds", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [
      { userId: "user-1", name: "Diana Colaboradora", role: "colaborador", team: "SGN360" },
      { userId: "user-2", name: "Fabio Colaborador", role: "colaborador", team: "SGM365" },
    ],
  });
  await seedResponse(request, {
    method: "POST",
    path: "/notifications/pagamentos",
    status: 201,
    response: { sent: 1 },
  });

  await page.goto("/pagamentos");
  await page.getByRole("button", { name: "Salário" }).click();
  await page.getByLabel("Filtrar por time em Salário").selectOption("SGN360");
  await page.getByRole("button", { name: /Enviar para todos/ }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/notifications/pagamentos")?.body;
    })
    .toEqual({ category: "salario", userIds: ["user-1"] });
});

test("'Enviar para todos' is disabled when the filtered list is empty", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [{ userId: "user-1", name: "Diana Colaboradora", role: "colaborador", team: null }],
  });

  await page.goto("/pagamentos");
  await page.getByRole("button", { name: "Salário" }).click();
  await page.getByLabel("Buscar colaborador em Salário").fill("zzz");

  await expect(page.getByRole("button", { name: /Enviar para todos/ })).toBeDisabled();
});

test("shows an inline error when the send fails", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [{ userId: "user-1", name: "Diana Colaboradora", role: "colaborador", team: null }],
  });
  await seedResponse(request, {
    method: "POST",
    path: "/notifications/pagamentos",
    status: 500,
    response: { message: "Internal error" },
  });

  await page.goto("/pagamentos");
  await page.getByRole("button", { name: "Salário" }).click();
  await page.getByRole("button", { name: "Enviar", exact: true }).click();

  await expect(page.getByText("Não foi possível enviar. Tente novamente.")).toBeVisible();
});
