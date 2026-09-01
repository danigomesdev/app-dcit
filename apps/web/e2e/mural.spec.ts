import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi } from "./test-session";

test("colaborador sees a permission message instead of the mural", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/mural");

  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
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
