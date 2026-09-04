import { test, expect } from "@playwright/test";

import { addSessionCookie } from "./test-session";

// Convenções was removed entirely — no role has access anymore (RH was the
// only role that ever had it).
for (const role of ["colaborador", "gestor", "rh"] as const) {
  test(`${role} sees a permission message — convenções is no longer available`, async ({
    page,
    context,
  }) => {
    await addSessionCookie(context, { sub: `${role}-1`, role, name: "Test" });
    await page.goto("/convencoes");

    await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
  });
}
