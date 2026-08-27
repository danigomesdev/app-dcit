import { test, expect } from "@playwright/test";

import { addSessionCookie } from "./test-session";

test.beforeEach(async ({ context }) => {
  await addSessionCookie(context);
});

test("aprovações page renders its empty state", async ({ page }) => {
  await page.goto("/aprovacoes");
  await expect(page.getByRole("heading", { name: "Fila de aprovações" })).toBeVisible();
  await expect(
    page.getByText(
      "As solicitações de férias e justificativas pendentes de validação vão aparecer aqui."
    )
  ).toBeVisible();
});

test("documentos page renders its empty state", async ({ page }) => {
  await page.goto("/documentos");
  await expect(page.getByRole("heading", { name: "Documentos e atestados" })).toBeVisible();
  await expect(
    page.getByText(
      "Os documentos e atestados enviados pelos colaboradores vão aparecer aqui."
    )
  ).toBeVisible();
});
