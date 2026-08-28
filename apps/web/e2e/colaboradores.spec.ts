import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi, seedResponse } from "./test-session";

test("colaborador sees a permission message instead of the roster", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/colaboradores");

  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("gestor sees a permission message instead of the roster", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await page.goto("/colaboradores");

  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("rh sees the roster with the current expected start time prefilled", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [{ userId: "colaborador-1", name: "Ana Colaboradora", expectedStartTime: "09:00" }],
  });

  await page.goto("/colaboradores");

  await expect(page.getByText("Ana Colaboradora")).toBeVisible();
  await expect(
    page.getByLabel("Horário esperado de entrada de Ana Colaboradora")
  ).toHaveValue("09:00");
});

test("saving a valid schedule calls the API with the new time", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [{ userId: "colaborador-1", name: "Ana Colaboradora", expectedStartTime: null }],
  });

  await page.goto("/colaboradores");
  await page.getByLabel("Horário esperado de entrada de Ana Colaboradora").fill("08:30");
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "PATCH" && r.path === "/employees/colaborador-1")
        ?.body;
    })
    .toEqual({ expectedStartTime: "08:30" });
});

test("clearing the schedule calls the API with null", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [{ userId: "colaborador-1", name: "Ana Colaboradora", expectedStartTime: "09:00" }],
  });

  await page.goto("/colaboradores");
  await page.getByLabel("Horário esperado de entrada de Ana Colaboradora").fill("");
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "PATCH" && r.path === "/employees/colaborador-1")
        ?.body;
    })
    .toEqual({ expectedStartTime: null });
});

test("a failed save shows an inline error instead of crashing the page", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [{ userId: "colaborador-1", name: "Ana Colaboradora", expectedStartTime: "09:00" }],
  });
  await seedResponse(request, {
    method: "PATCH",
    path: "/employees/colaborador-1",
    status: 500,
    response: { message: "Internal server error" },
  });

  await page.goto("/colaboradores");
  await page.getByLabel("Horário esperado de entrada de Ana Colaboradora").fill("08:30");
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByText("Não foi possível salvar (código 500).")).toBeVisible();
});
