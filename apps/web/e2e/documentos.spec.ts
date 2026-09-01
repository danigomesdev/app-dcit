import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi, seedResponse } from "./test-session";

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

test("shows a certification's UTC calendar day, not a day shifted by local timezone", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  // validUntil is a date-only value stored as UTC midnight (same reasoning
  // as banco-de-horas/page.tsx's formatMonthLabel/formatDayLabel and
  // aprovacoes/page.tsx's formatDateOnly). Without formatDate's explicit
  // timeZone: "UTC", this UTC-midnight instant would render in the server's
  // ambient timezone (America/Sao_Paulo, UTC-3) as September 30th instead
  // of October 1st — a regression the noon-UTC fixtures used elsewhere in
  // this file wouldn't catch, since noon UTC never crosses a day boundary
  // in UTC-3.
  await mockApi(request, {
    certifications: [
      {
        id: "cert-2",
        userId: "user-4",
        userName: "Gabriela Colaboradora",
        name: "PMP",
        institution: "PMI",
        validUntil: "2026-10-01T00:00:00.000Z",
      },
    ],
  });

  await page.goto("/documentos");

  await expect(page.getByText("Gabriela Colaboradora")).toBeVisible();
  await expect(page.getByText("válida até 01/10/2026")).toBeVisible();
  await expect(page.getByText("válida até 30/09/2026")).toHaveCount(0);
});

test("shows a proper label instead of the raw status for an admissionais document", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    admissionDocuments: [
      {
        id: "adm-2",
        userId: "user-3",
        userName: "Fábio Colaborador",
        title: "RG",
        status: "enviado",
        submittedAt: "2026-08-20T12:00:00.000Z",
      },
    ],
  });

  await page.goto("/documentos");

  await expect(page.getByText("Fábio Colaborador")).toBeVisible();
  await expect(page.getByText("Enviado", { exact: true })).toBeVisible();
  await expect(page.getByText("enviado", { exact: true })).toHaveCount(0);
});

test("colaborador sees category tabs, with Atestados active by default", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [], myCertifications: [], myAtestados: [] });

  await page.goto("/documentos");

  const admissionais = page.getByRole("link", { name: "Admissionais" });
  const atestados = page.getByRole("link", { name: "Atestados" });
  const certificacoes = page.getByRole("link", { name: "Certificações" });
  await expect(admissionais).toBeVisible();
  await expect(atestados).toBeVisible();
  await expect(certificacoes).toBeVisible();
  await expect(atestados).toHaveClass(/categoryTabActive/);

  await admissionais.click();
  await expect(page).toHaveURL(/categoria=admissionais/);
  await expect(admissionais).toHaveClass(/categoryTabActive/);
  await expect(atestados).not.toHaveClass(/categoryTabActive/);
});

test("colaborador sees their own admissionais documents and can submit a new one without a photo", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    myAdmissionDocuments: [
      {
        id: "adm-1",
        title: "Comprovante de residência",
        photoUri: null,
        status: "enviado",
        submittedAt: "2026-08-20T12:00:00.000Z",
      },
    ],
    myCertifications: [],
    myAtestados: [],
  });
  await seedResponse(request, {
    method: "POST",
    path: "/documentos/admissionais",
    status: 201,
    response: { id: "adm-new", title: "RG", photoUri: null, status: "enviado", submittedAt: "2026-08-31T12:00:00.000Z" },
  });

  await page.goto("/documentos?categoria=admissionais");

  await expect(page.getByText("Comprovante de residência")).toBeVisible();
  await expect(page.getByText("Enviado", { exact: true })).toBeVisible();

  await seedResponse(request, {
    method: "GET",
    path: "/documentos/admissionais",
    response: [
      { id: "adm-new", title: "RG", photoUri: null, status: "enviado", submittedAt: "2026-08-31T12:00:00.000Z" },
      { id: "adm-1", title: "Comprovante de residência", photoUri: null, status: "enviado", submittedAt: "2026-08-20T12:00:00.000Z" },
    ],
  });

  await page.getByLabel("Título").fill("RG");
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/documentos/admissionais")?.body;
    })
    .toEqual({ title: "RG" });

  await expect(page.getByText("RG", { exact: true })).toBeVisible();
});

test("shows a message when there are no admissionais documents yet", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [], myCertifications: [], myAtestados: [] });

  await page.goto("/documentos?categoria=admissionais");

  await expect(page.getByText("Nenhum documento admissional enviado ainda.")).toBeVisible();
});
