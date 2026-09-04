import { test, expect } from "@playwright/test";

import { seedResponse } from "./test-session";

function fakeSessionToken(claims: { sub: string; role: string; name: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.fixture-signature`;
}

test("logs in with email/password and lands on the app", async ({ page, request }) => {
  await seedResponse(request, {
    method: "POST",
    path: "/auth/password-login",
    status: 200,
    response: {
      token: fakeSessionToken({ sub: "gestor-1", role: "gestor", name: "Bruno Gestor" }),
      role: "gestor",
      name: "Bruno Gestor",
    },
  });
  await seedResponse(request, { method: "GET", path: "/time-entries/team", response: [] });

  await page.goto("/login");
  await page.getByPlaceholder("Email").fill("gestor@dev.local");
  await page.getByPlaceholder("Senha").fill("dev12345");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Colaboradores", exact: true })).toBeVisible();
});

test("shows an inline error for wrong credentials, without navigating away", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill("gestor@dev.local");
  await page.getByPlaceholder("Senha").fill("wrong-password");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByText("Email ou senha incorretos.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("login page renders the email/password form, no SSO link, no app sidebar", async ({
  page,
}) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Portal SGP" })).toBeVisible();
  await expect(page.getByPlaceholder("Email")).toBeVisible();
  await expect(page.getByPlaceholder("Senha")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Esqueci minha senha" })).toBeVisible();

  await expect(page.getByRole("link", { name: "Entrar com SSO" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Aprovações" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Documentos" })).toHaveCount(0);
});
