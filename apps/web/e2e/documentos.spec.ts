import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi, seedResponse } from "./test-session";

test("colaborador sees a permission message instead of the documents list", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/documentos");

  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("rh sees clinical detail; gestor sees the same atestado without it", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    atestados: [
      {
        id: "at-1",
        userName: "Carlos Colaborador",
        cid: "J11",
        crm: "CRM-MG 12345",
        medico: "Dr. Teste",
        dias: 2,
        status: "aprovado",
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
  });

  await page.goto("/documentos");
  await expect(page.getByText("Carlos Colaborador")).toBeVisible();
  await expect(page.getByText("J11")).toBeVisible();
  await expect(page.getByText("Dr. Teste")).toBeVisible();

  // Same fixture data, but as the API masks cid/crm/medico for a gestor
  // caller (not this fake server, which just echoes what's seeded) — this
  // seeds the already-masked shape a gestor would actually receive.
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await mockApi(request, {
    atestados: [
      {
        id: "at-1",
        userName: "Carlos Colaborador",
        cid: null,
        crm: null,
        medico: null,
        dias: 2,
        status: "aprovado",
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
  });

  await page.goto("/documentos");
  await expect(page.getByText("Carlos Colaborador")).toBeVisible();
  await expect(page.getByText("J11")).toHaveCount(0);
  await expect(page.getByText("Dr. Teste")).toHaveCount(0);
});

test("rh can view the atestado photo; gestor never sees the button", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    atestados: [
      {
        id: "at-1",
        userName: "Carlos Colaborador",
        cid: "J11",
        crm: "CRM-MG 12345",
        medico: "Dr. Teste",
        dias: 2,
        status: "aprovado",
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
  });
  await seedResponse(request, {
    method: "GET",
    path: "/atestados/at-1/photo",
    response: { photoDataUrl: "data:image/jpeg;base64,ZmFrZQ==" },
  });

  await page.goto("/documentos");
  await page.getByRole("button", { name: "Ver foto" }).click();
  await expect(page.getByAltText("Foto do atestado")).toBeVisible();
  await expect(page.getByAltText("Foto do atestado")).toHaveAttribute(
    "src",
    "data:image/jpeg;base64,ZmFrZQ=="
  );

  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await mockApi(request, {
    atestados: [
      {
        id: "at-1",
        userName: "Carlos Colaborador",
        cid: null,
        crm: null,
        medico: null,
        dias: 2,
        status: "aprovado",
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
  });

  await page.goto("/documentos");
  await expect(page.getByRole("button", { name: "Ver foto" })).toHaveCount(0);
});

test("lists admission documents and certifications submitted by the team", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    admissionDocuments: [
      {
        id: "adm-1",
        userId: "user-1",
        userName: "Diana Colaboradora",
        title: "Comprovante de residência",
        status: "enviado",
        submittedAt: "2026-08-20T12:00:00.000Z",
      },
    ],
    certifications: [
      {
        id: "cert-1",
        userId: "user-2",
        userName: "Elias Colaborador",
        name: "AWS Certified",
        institution: "Amazon",
        validUntil: "2028-10-10T00:00:00.000Z",
      },
    ],
  });

  await page.goto("/documentos");

  await expect(page.getByRole("heading", { name: "Documentos admissionais" })).toBeVisible();
  await expect(page.getByText("Diana Colaboradora")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Certificações" })).toBeVisible();
  await expect(page.getByText("Elias Colaborador")).toBeVisible();
});
