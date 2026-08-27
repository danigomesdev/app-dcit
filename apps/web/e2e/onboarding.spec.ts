import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi } from "./test-session";

test("colaborador sees a permission message instead of the onboarding page", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/onboarding");

  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("shows each employee's onboarding progress for a gestor", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    onboardingProgress: [
      { userId: "user-1", userName: "Diana Colaboradora", completedCount: 3, totalCount: 5 },
      { userId: "user-2", userName: "Elias Colaborador", completedCount: 5, totalCount: 5 },
    ],
  });

  await page.goto("/onboarding");

  await expect(page.getByRole("heading", { name: "Onboarding" })).toBeVisible();
  await expect(page.getByText("3 de 5 tarefas concluídas")).toBeVisible();
  await expect(page.getByText("Concluído")).toBeVisible();
});
