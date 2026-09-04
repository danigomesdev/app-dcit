import { test, expect } from "@playwright/test";

import { addSessionCookie } from "./test-session";

// Operacional was removed entirely — no role has access anymore.
for (const role of ["colaborador", "gestor", "rh"] as const) {
  test(`${role} sees a permission message — operacional is no longer available`, async ({
    page,
    context,
  }) => {
    await addSessionCookie(context, { sub: `${role}-1`, role, name: "Test" });
    await page.goto("/operacional");

    await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
  });
}
