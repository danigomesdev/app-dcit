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

const TASKS = [
  { id: "task-1", title: "Assine o contrato", description: "Assine o contrato de trabalho" },
  { id: "task-2", title: "Configure acessos", description: "Configure seus acessos ao sistema" },
];

test("shows each employee's onboarding progress for a gestor", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    onboardingProgress: [
      {
        userId: "user-1",
        userName: "Diana Colaboradora",
        completedCount: 1,
        totalCount: 2,
        tasks: TASKS,
        completedTaskIds: ["task-1"],
      },
      {
        userId: "user-2",
        userName: "Elias Colaborador",
        completedCount: 2,
        totalCount: 2,
        tasks: TASKS,
        completedTaskIds: ["task-1", "task-2"],
      },
    ],
  });

  await page.goto("/onboarding");

  await expect(page.getByRole("heading", { name: "Onboarding" })).toBeVisible();
  await expect(page.getByText("1 de 2 tarefas concluídas")).toBeVisible();
  await expect(page.getByText("Concluído")).toBeVisible();
});

test("clicking an employee opens the task list with done/pending status", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    onboardingProgress: [
      {
        userId: "user-1",
        userName: "Diana Colaboradora",
        completedCount: 1,
        totalCount: 2,
        tasks: TASKS,
        completedTaskIds: ["task-1"],
      },
    ],
  });

  await page.goto("/onboarding");
  await page.getByRole("button", { name: /Diana Colaboradora/ }).click();

  await expect(page.getByText("Tarefas de Diana Colaboradora")).toBeVisible();
  const doneTask = page.locator("li", { hasText: "Assine o contrato" });
  await expect(doneTask.getByText("Concluída")).toBeVisible();
  const pendingTask = page.locator("li", { hasText: "Configure acessos" });
  await expect(pendingTask.getByText("Pendente")).toBeVisible();
});
