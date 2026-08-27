import { test, expect } from "@playwright/test";

import { addSessionCookie } from "./test-session";

test("visiting a protected route without a session redirects to /login", async ({ page }) => {
  await page.goto("/aprovacoes");
  await expect(page).toHaveURL(/\/login$/);
});

test("visiting /login with an existing session redirects to the dashboard", async ({
  page,
  context,
}) => {
  await addSessionCookie(context);
  await page.goto("/login");
  await expect(page).toHaveURL("http://localhost:3001/");
});

test("clicking Entrar com SSO completes login and lands on the dashboard", async ({
  page,
  context,
}) => {
  // Stand in for the real API: GET /auth/login normally redirects to the
  // IdP, which redirects back to GET /auth/callback, which sets the session
  // cookie and redirects to the web app. Faking that whole chain here keeps
  // this suite self-contained (no API/mock-IdP process to boot) — see the
  // e2e testing note in the auth design for why that's the deliberate
  // trade-off for the web app's login flow.
  await context.route("http://localhost:3000/auth/login**", async (route) => {
    await addSessionCookie(context);
    await route.fulfill({
      status: 302,
      headers: { location: "http://localhost:3001/" },
    });
  });

  await page.goto("/login");
  await page.getByRole("link", { name: "Entrar com SSO" }).click();

  await expect(page).toHaveURL("http://localhost:3001/");
  await expect(page.getByRole("link", { name: "Aprovações" })).toBeVisible();
});

test("logging out clears the session and returns to /login", async ({ page, context }) => {
  await addSessionCookie(context);
  await page.goto("/");

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/aprovacoes");
  await expect(page).toHaveURL(/\/login$/);
});
