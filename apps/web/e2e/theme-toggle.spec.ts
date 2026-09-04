import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi } from "./test-session";

test("clicking the theme icon toggles and persists the theme across reloads", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request);
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: "Alterar tema" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Alterar tema" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
