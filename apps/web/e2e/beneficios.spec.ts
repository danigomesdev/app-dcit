import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi } from "./test-session";

test("colaborador sees a permission message instead of the benefits page", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/beneficios");

  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("lists each employee's benefit balance and the partner catalog for a gestor", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    balances: [
      {
        id: "bal-1",
        userId: "user-1",
        userName: "Diana Colaboradora",
        label: "Vale-refeição",
        balance: 250,
        monthlyCredit: 600,
      },
    ],
    partners: [{ id: "p-1", name: "Smart Fit", category: "Academia", discount: "20% de desconto" }],
  });

  await page.goto("/beneficios");

  await expect(page.getByRole("heading", { name: "Benefícios" })).toBeVisible();
  await expect(page.getByText("Diana Colaboradora")).toBeVisible();
  await expect(page.getByText("Smart Fit")).toBeVisible();
});

test("groups a colaborador's balances behind their name, collapsed until clicked", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    balances: [
      {
        id: "bal-1",
        userId: "user-1",
        userName: "Diana Colaboradora",
        label: "Vale-refeição",
        balance: 250,
        monthlyCredit: 600,
      },
      {
        id: "bal-2",
        userId: "user-1",
        userName: "Diana Colaboradora",
        label: "Plano de saúde",
        balance: 0,
        monthlyCredit: 0,
      },
    ],
    partners: [],
  });

  await page.goto("/beneficios");

  const toggle = page.getByRole("button", { name: /Diana Colaboradora/ });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("2 benefícios")).toBeVisible();
  await expect(page.getByText("Vale-refeição")).toHaveCount(0);
  await expect(page.getByText("Plano de saúde")).toHaveCount(0);

  await toggle.click();

  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Vale-refeição")).toBeVisible();
  await expect(page.getByText("Plano de saúde")).toBeVisible();

  await toggle.click();

  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("Vale-refeição")).toHaveCount(0);
});
