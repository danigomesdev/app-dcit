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
