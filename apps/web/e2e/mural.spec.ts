import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi, seedResponse } from "./test-session";

function todaySaoPauloMonthDay(): { day: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { day: get("day"), month: get("month") };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

test("colaborador sees today's and this month's birthdays, but not a birthday from another month", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  const today = todaySaoPauloMonthDay();
  const monthDay = (today.day % 28) + 1; // always different from today.day, valid in every month
  const otherMonth = (today.month % 12) + 1; // always different from today.month
  await mockApi(request, {
    muralPosts: [],
    birthdays: [
      { name: "Diana Colaboradora", day: today.day, month: today.month },
      { name: "Marcos Colega", day: monthDay, month: today.month },
      { name: "Outro Mês", day: 10, month: otherMonth },
    ],
  });

  await page.goto("/mural");

  await expect(page.getByText("Aniversariante(s) de hoje: Diana Colaboradora")).toBeVisible();
  await expect(
    page.getByText(`Também fazem aniversário este mês: Marcos Colega (${pad(monthDay)}/${pad(today.month)})`),
  ).toBeVisible();
  await expect(page.getByText("Outro Mês")).toHaveCount(0);
});

test("shows a message when there are no birthdays this month", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  const today = todaySaoPauloMonthDay();
  const otherMonth = (today.month % 12) + 1;
  await mockApi(request, {
    muralPosts: [
      {
        id: "post-1",
        glyph: "🎉",
        title: "Boas-vindas!",
        body: "Texto.",
        reactionCount: 0,
        reacted: false,
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
    birthdays: [{ name: "Outro Mês", day: 10, month: otherMonth }],
  });

  await page.goto("/mural");

  await expect(page.getByText("Nenhum aniversariante este mês.")).toBeVisible();
});

test("colaborador sees mural posts with title, body and publish date", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    muralPosts: [
      {
        id: "post-1",
        glyph: "🎉",
        title: "Boas-vindas!",
        body: "Damos as boas-vindas ao novo time de suporte.",
        reactionCount: 4,
        reacted: false,
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
    birthdays: [],
  });

  await page.goto("/mural");

  await expect(page.getByRole("heading", { name: "Mural" })).toBeVisible();
  await expect(page.getByText("Boas-vindas!")).toBeVisible();
  await expect(page.getByText("Damos as boas-vindas ao novo time de suporte.")).toBeVisible();
  await expect(page.getByText("publicado em 20/08/2026")).toBeVisible();
});

test("shows a message when there are no posts yet", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    muralPosts: [],
    birthdays: [{ name: "Diana Colaboradora", day: 1, month: 1 }],
  });

  await page.goto("/mural");

  await expect(page.getByText("Nenhum comunicado publicado ainda.")).toBeVisible();
});

test("lists mural posts with reaction counts and upcoming birthdays for a gestor", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    muralPosts: [
      {
        id: "post-1",
        glyph: "🎉",
        title: "Boas-vindas!",
        body: "Damos as boas-vindas ao novo time de suporte.",
        reactionCount: 4,
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
    birthdays: [{ name: "Diana Colaboradora", day: 15, month: 9 }],
  });

  await page.goto("/mural");

  await expect(page.getByRole("heading", { name: "Mural" })).toBeVisible();
  await expect(page.getByText("Boas-vindas!")).toBeVisible();
  await expect(page.getByText("4 reação(ões)")).toBeVisible();
  await expect(page.getByText("Diana Colaboradora · 15 de setembro")).toBeVisible();
});

test("shows a mural post's UTC calendar day, not a day shifted by local timezone", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  // createdAt is a UTC-midnight instant (same reasoning as documentos.spec.ts's
  // certification UTC test) — without formatDate's explicit timeZone: "UTC",
  // this would render as September 30th instead of October 1st in the
  // server's ambient America/Sao_Paulo (UTC-3) timezone.
  await mockApi(request, {
    muralPosts: [
      {
        id: "post-2",
        glyph: "📣",
        title: "Aviso importante",
        body: "Confira o novo procedimento.",
        reactionCount: 0,
        createdAt: "2026-10-01T00:00:00.000Z",
      },
    ],
    birthdays: [],
  });

  await page.goto("/mural");

  await expect(page.getByText("Aviso importante")).toBeVisible();
  await expect(page.getByText("publicado em 01/10/2026")).toBeVisible();
  await expect(page.getByText("publicado em 30/09/2026")).toHaveCount(0);
});

test("shows the reaction button's count and reacted state", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    muralPosts: [
      {
        id: "post-1",
        glyph: "🎉",
        title: "Boas-vindas!",
        body: "Texto.",
        reactionCount: 4,
        reacted: false,
        createdAt: "2026-08-20T12:00:00.000Z",
      },
      {
        id: "post-2",
        glyph: "📣",
        title: "Aviso",
        body: "Texto 2.",
        reactionCount: 1,
        reacted: true,
        createdAt: "2026-08-21T12:00:00.000Z",
      },
    ],
    birthdays: [],
  });

  await page.goto("/mural");

  const unreacted = page.getByRole("button", { name: "♡ 4" });
  const reacted = page.getByRole("button", { name: "♥ 1" });
  await expect(unreacted).toBeVisible();
  await expect(reacted).toBeVisible();
  await expect(reacted).toHaveClass(/reactionButtonActive/);
  await expect(unreacted).not.toHaveClass(/reactionButtonActive/);
});

test("clicking the reaction button toggles it via the API and reflects the new state", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    muralPosts: [
      {
        id: "post-1",
        glyph: "🎉",
        title: "Boas-vindas!",
        body: "Texto.",
        reactionCount: 4,
        reacted: false,
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
    birthdays: [],
  });
  await seedResponse(request, {
    method: "POST",
    path: "/mural/posts/post-1/react",
    response: { reactionCount: 5, reacted: true },
  });

  await page.goto("/mural");

  await seedResponse(request, {
    method: "GET",
    path: "/mural/posts",
    response: [
      {
        id: "post-1",
        glyph: "🎉",
        title: "Boas-vindas!",
        body: "Texto.",
        reactionCount: 5,
        reacted: true,
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
  });

  await page.getByRole("button", { name: "♡ 4" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/mural/posts/post-1/react");
    })
    .toBeTruthy();

  await expect(page.getByRole("button", { name: "♥ 5" })).toBeVisible();
});
