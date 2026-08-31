import { test, expect } from "@playwright/test";

import { seedResponse } from "./test-session";

test("requests a reset code, shows the dev code, and redefines the password", async ({
  page,
  request,
}) => {
  await seedResponse(request, {
    method: "POST",
    path: "/auth/forgot-password",
    status: 200,
    response: { devCode: "123456" },
  });

  await page.goto("/esqueci-senha");
  await page.getByPlaceholder("Email ou telefone").fill("colaborador@dev.local");
  await page.getByRole("button", { name: "Enviar código" }).click();

  await expect(page.getByText("123456")).toBeVisible();
  await expect(page.getByText(/Modo de desenvolvimento/)).toBeVisible();

  await seedResponse(request, {
    method: "POST",
    path: "/auth/reset-password",
    status: 200,
    response: { ok: true },
  });

  await page.getByPlaceholder("Código de 6 dígitos").fill("123456");
  await page.getByPlaceholder("Nova senha").fill("novaSenha123");
  await page.getByRole("button", { name: "Redefinir senha" }).click();

  await expect(page.getByText("Senha redefinida com sucesso.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Voltar ao login" })).toBeVisible();
});

test("shows a generic message (no dev code) for an unknown identifier", async ({ page }) => {
  await page.goto("/esqueci-senha");
  await page.getByPlaceholder("Email ou telefone").fill("nao-existe@dev.local");
  await page.getByRole("button", { name: "Enviar código" }).click();

  await expect(page.getByText("Se essa conta existir, um código foi gerado.")).toBeVisible();
  await expect(page.getByText(/Modo de desenvolvimento/)).toHaveCount(0);
});

test("shows an error for an invalid reset code", async ({ page }) => {
  await page.goto("/esqueci-senha");
  await page.getByPlaceholder("Email ou telefone").fill("colaborador@dev.local");
  await page.getByRole("button", { name: "Enviar código" }).click();

  await page.getByPlaceholder("Código de 6 dígitos").fill("000000");
  await page.getByPlaceholder("Nova senha").fill("novaSenha123");
  await page.getByRole("button", { name: "Redefinir senha" }).click();

  await expect(page.getByText("Código inválido ou expirado.")).toBeVisible();
});
