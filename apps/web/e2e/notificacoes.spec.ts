import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi } from "./test-session";

test("shows no badge when there are no unread notifications", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    notifications: [
      {
        id: "n1",
        type: "pagamento",
        category: "salario",
        message: "Seu salário foi depositado.",
        link: null,
        createdAt: "2026-09-01T12:00:00.000Z",
        readAt: "2026-09-01T13:00:00.000Z",
      },
    ],
  });

  await page.goto("/");

  const bellButton = page.getByLabel("Notificações");
  await expect(bellButton).toBeVisible();
  await expect(bellButton).not.toContainText(/\d/);
});

test("shows the exact unread count on the badge", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    notifications: [
      {
        id: "n1",
        type: "pagamento",
        category: "salario",
        message: "Notificação 1",
        link: null,
        createdAt: "2026-09-03T12:00:00.000Z",
        readAt: null,
      },
      {
        id: "n2",
        type: "pagamento",
        category: "salario",
        message: "Notificação 2",
        link: null,
        createdAt: "2026-09-02T12:00:00.000Z",
        readAt: null,
      },
      {
        id: "n3",
        type: "pagamento",
        category: "salario",
        message: "Notificação 3",
        link: null,
        createdAt: "2026-09-01T12:00:00.000Z",
        readAt: "2026-09-01T13:00:00.000Z",
      },
    ],
  });

  await page.goto("/");

  await expect(page.getByLabel("Notificações")).toContainText("2");
});

test("caps the badge at 9+ when there are more than 9 unread", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  const unread = Array.from({ length: 11 }, (_, i) => ({
    id: `n${i + 1}`,
    type: "pagamento",
    category: "salario",
    message: `Notificação ${i + 1}`,
    link: null,
    createdAt: `2026-09-${String(11 - i).padStart(2, "0")}T12:00:00.000Z`,
    readAt: null,
  }));
  await mockApi(request, { notifications: unread });

  await page.goto("/");

  await expect(page.getByLabel("Notificações")).toContainText("9+");
});

test("opening the bell shows only the 10 most recent notifications", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  // Pre-sorted newest first, same as the real listMine (orderBy createdAt desc)
  // — the fake server returns whatever is seeded verbatim, it does not sort.
  const notifications = Array.from({ length: 11 }, (_, i) => ({
    id: `n${i + 1}`,
    type: "pagamento",
    category: "salario",
    message: `Notificação ${i + 1}`,
    link: null,
    createdAt: `2026-09-${String(11 - i).padStart(2, "0")}T12:00:00.000Z`,
    readAt: "2026-09-01T00:00:00.000Z",
  }));
  await mockApi(request, { notifications });

  await page.goto("/");
  await page.getByLabel("Notificações").click();

  // exact: true avoids Playwright's default substring match. Without it,
  // "Notificação 1" also matches "Notificação 10" (a literal substring),
  // and — since JSX strips the whitespace between the message/date spans —
  // the button's raw textContent glues them together with no separator,
  // so "Notificação 11" would also spuriously match n1's button text
  // ("Notificação 1" immediately followed by its date "11/09/2026...").
  await expect(page.getByText("Notificação 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Notificação 10", { exact: true })).toBeVisible();
  await expect(page.getByText("Notificação 11", { exact: true })).toHaveCount(0);
});

test("shows an empty message when there are no notifications", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { notifications: [] });

  await page.goto("/");
  await page.getByLabel("Notificações").click();

  await expect(page.getByText("Nenhuma notificação.")).toBeVisible();
});

test("clicking an unread notification marks it read and updates the badge, without navigating when link is null", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    notifications: [
      {
        id: "n1",
        type: "pagamento",
        category: "salario",
        message: "Seu salário foi depositado.",
        link: null,
        createdAt: "2026-09-01T12:00:00.000Z",
        readAt: null,
      },
    ],
  });

  await page.goto("/");
  await page.getByLabel("Notificações").click();
  await expect(page.getByLabel("Notificações")).toContainText("1");

  await page.getByText("Seu salário foi depositado.").click();

  await expect(page.getByLabel("Notificações")).not.toContainText(/\d/);
  expect(page.url()).toMatch(/\/$/);

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/notifications/n1/read");
    })
    .toBeTruthy();
});

test("clicking a notification with a link navigates there", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    notifications: [
      {
        id: "n1",
        type: "ponto_perdido",
        category: null,
        message: "Você esqueceu de bater o ponto ontem.",
        link: "/historico",
        createdAt: "2026-09-01T12:00:00.000Z",
        readAt: null,
      },
    ],
  });

  await page.goto("/");
  await page.getByLabel("Notificações").click();
  await page.getByText("Você esqueceu de bater o ponto ontem.").click();

  await page.waitForURL("**/historico");
});

test("the bell is visible to colaborador, gestor, and rh", async ({ page, context, request }) => {
  await mockApi(request, { notifications: [] });

  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/");
  await expect(page.getByLabel("Notificações")).toBeVisible();

  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await page.goto("/");
  await expect(page.getByLabel("Notificações")).toBeVisible();

  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await page.goto("/");
  await expect(page.getByLabel("Notificações")).toBeVisible();
});
