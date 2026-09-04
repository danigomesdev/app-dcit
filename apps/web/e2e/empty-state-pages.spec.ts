import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi } from "./test-session";

test.beforeEach(async ({ context }) => {
  await addSessionCookie(context);
});

test("aprovações page renders its empty state when there's nothing pending", async ({
  page,
  request,
}) => {
  await mockApi(request);
  await page.goto("/aprovacoes");
  await expect(page.getByRole("heading", { name: "Fila de aprovações" })).toBeVisible();
  await expect(
    page.getByText(
      "As solicitações de férias e justificativas pendentes de validação vão aparecer aqui."
    )
  ).toBeVisible();
});

test("documentos page renders its empty state", async ({ page, request }) => {
  await mockApi(request);
  await page.goto("/documentos");
  await expect(page.getByRole("heading", { name: "Documentos e atestados" })).toBeVisible();
  await expect(
    page.getByText(
      "Os documentos e atestados enviados pelos colaboradores vão aparecer aqui."
    )
  ).toBeVisible();
});

test("mural page renders its empty state", async ({ page, request }) => {
  await mockApi(request);
  await page.goto("/mural");
  await expect(page.getByRole("heading", { name: "Mural" })).toBeVisible();
  await expect(
    page.getByText("Os comunicados publicados no mural vão aparecer aqui.")
  ).toBeVisible();
});

test("benefícios page renders its empty state", async ({ page, request }) => {
  await mockApi(request);
  await page.goto("/beneficios");
  await expect(page.getByRole("heading", { name: "Benefícios" })).toBeVisible();
  await expect(
    page.getByText("Os saldos de benefícios dos colaboradores vão aparecer aqui.")
  ).toBeVisible();
});

test("onboarding page renders its empty state", async ({ page, request }) => {
  await mockApi(request);
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Onboarding" })).toBeVisible();
  await expect(
    page.getByText("O progresso de integração dos colaboradores vai aparecer aqui.")
  ).toBeVisible();
});
