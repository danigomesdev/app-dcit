import { test, expect } from "@playwright/test";

import { addSessionCookie } from "./test-session";

test("home page renders the product name", async ({ page, context }) => {
  await addSessionCookie(context);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ponto DCIT" })).toBeVisible();
});
