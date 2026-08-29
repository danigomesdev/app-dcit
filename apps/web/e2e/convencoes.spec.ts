import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi } from "./test-session";

test("colaborador sees a permission message instead of the convenções list", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/convencoes");

  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("gestor sees a permission message instead of the convenções list", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await page.goto("/convencoes");

  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("rh sees the convenções list", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    convencoes: [
      {
        id: "conv-1",
        nome: "Convenção Metalúrgicos",
        cnpj: "12345678000199",
        categoriaSindical: "Metalúrgicos",
        expectedDailyMinutes: 480,
        overtimePercent: 50,
      },
    ],
  });

  await page.goto("/convencoes");

  await expect(page.getByRole("heading", { name: "Convenções coletivas" })).toBeVisible();
  await expect(page.getByText("Convenção Metalúrgicos", { exact: true })).toBeVisible();
  await expect(page.getByText(/8h.*50%/)).toBeVisible();
});

test("opens the dialog and creates a new convenção with the API", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, { convencoes: [] });

  await page.goto("/convencoes");
  await page.getByRole("button", { name: "+ Nova convenção" }).click();
  await page.getByLabel("Nome").fill("Convenção Nova");
  await page.getByLabel("Jornada esperada por dia (minutos)").fill("440");
  await page.getByLabel("Percentual de hora extra").fill("60");
  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/convencoes")?.body;
    })
    .toEqual({
      nome: "Convenção Nova",
      cnpj: null,
      categoriaSindical: null,
      expectedDailyMinutes: "440",
      overtimePercent: "60",
    });
});

test("removing a convenção calls the API", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    convencoes: [
      {
        id: "conv-del",
        nome: "Convenção A Remover",
        cnpj: null,
        categoriaSindical: null,
        expectedDailyMinutes: 480,
        overtimePercent: 50,
      },
    ],
  });

  await page.goto("/convencoes");
  await page.getByRole("button", { name: "Excluir" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.some((r) => r.method === "DELETE" && r.path === "/convencoes/conv-del");
    })
    .toBe(true);
});
