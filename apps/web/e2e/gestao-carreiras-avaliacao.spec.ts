import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi, seedResponse, getRecordedRequests } from "./test-session";

const EMPLOYEES = [
  { userId: "colab-1", name: "Ana Colaboradora", nivel: "pleno", cargo: "desenvolvedor", salarioMensal: 4700 },
];

test("shows the header summary card and the requisitos checklist for the próximo nível", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request);
  await seedResponse(request, { method: "GET", path: "/employees", response: EMPLOYEES });
  await seedResponse(request, {
    method: "GET",
    path: "/carreira/promotabilidade/colab-1",
    response: { status: "amarelo", mesesDeCasa: 14, requisitosPendentes: 0, metasPendentes: 0, metasPdiRegistradas: true, ultimaMediaAvaliacao: null },
  });

  await page.goto("/gestao-carreiras?aba=avaliacao-carreira&userId=colab-1");

  await expect(page.getByText("Analista Pleno")).toBeVisible();
  await expect(page.getByText("14 meses")).toBeVisible();
  await expect(page.getByText("Analista Sênior", { exact: false })).toBeVisible();
  await expect(page.getByText("3 anos ou mais como Pleno, com graduação completa")).toBeVisible();
  await expect(page.getByText("Habilidade comercial e insights de upsell")).toBeVisible();
});

test("shows a nível máximo notice instead of a checklist for an especialista", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request);
  await seedResponse(request, {
    method: "GET",
    path: "/employees",
    response: [{ userId: "colab-1", name: "Ana Colaboradora", nivel: "especialista", cargo: "devops", salarioMensal: 9200 }],
  });
  await seedResponse(request, {
    method: "GET",
    path: "/carreira/promotabilidade/colab-1",
    response: { status: "amarelo", mesesDeCasa: 40, requisitosPendentes: 0, metasPendentes: 0, metasPdiRegistradas: true, ultimaMediaAvaliacao: null },
  });

  await page.goto("/gestao-carreiras?aba=avaliacao-carreira&userId=colab-1");

  await expect(page.getByText("Nível máximo atingido")).toBeVisible();
});

test("saves an evaluation with the entered scores and requisitos", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request);
  await seedResponse(request, { method: "GET", path: "/employees", response: EMPLOYEES });
  await seedResponse(request, {
    method: "GET",
    path: "/carreira/promotabilidade/colab-1",
    response: { status: "amarelo", mesesDeCasa: 14, requisitosPendentes: 0, metasPendentes: 0, metasPdiRegistradas: true, ultimaMediaAvaliacao: null },
  });

  await page.goto("/gestao-carreiras?aba=avaliacao-carreira&userId=colab-1");

  for (const key of ["clareza", "meritocracia", "equilibrio", "transparencia", "desenvolvimento"]) {
    await page.locator(`input[name="nota-${key}"]`).fill("8");
  }
  for (const key of [
    "dominio_tecnico",
    "qualidade_solucoes",
    "kpis_tecnicos",
    "comunicacao_postura",
    "organizacao_crises",
    "visao_estrategica",
  ]) {
    await page.locator(`input[name="nota-${key}"]`).fill("7");
  }
  await page.getByRole("checkbox", { name: "3 anos ou mais como Pleno, com graduação completa" }).check();
  await page.getByRole("button", { name: "Salvar Avaliação" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/carreira/evaluations")?.body;
    })
    .toMatchObject({
      userId: "colab-1",
      requisitosAtendidos: ["3 anos ou mais como Pleno, com graduação completa"],
    });
});

test("shows the Elegível badge and confirms before promoting when eligible", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request);
  await seedResponse(request, { method: "GET", path: "/employees", response: EMPLOYEES });
  await seedResponse(request, {
    method: "GET",
    path: "/carreira/promotabilidade/colab-1",
    response: { status: "amarelo", mesesDeCasa: 14, requisitosPendentes: 0, metasPendentes: 0, metasPdiRegistradas: true, ultimaMediaAvaliacao: null },
  });
  await seedResponse(request, {
    method: "GET",
    path: "/carreira/evaluations",
    response: {
      id: "ev-existing",
      status: "salva",
      mediaGeral: 8.5,
      proximoNivel: "senior",
      principios: [],
      competencias: [],
      requisitos: [
        { tipo: "obrigatorio", label: "3 anos ou mais como Pleno, com graduação completa", atendido: true },
        { tipo: "obrigatorio", label: "Especialização desejável e no mínimo 3 certificações", atendido: true },
        { tipo: "obrigatorio", label: "Soft skills consolidadas e referência técnica", atendido: true },
      ],
    },
  });

  await page.goto("/gestao-carreiras?aba=avaliacao-carreira&userId=colab-1");

  await expect(page.getByText("Elegível para Promoção")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Submeter para Decisão da Diretoria" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/carreira/evaluations/ev-existing/decidir")?.body;
    })
    .toEqual({ confirmarPromocao: true });
});

test("cancelling the confirm dialog does not submit the decision", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request);
  await seedResponse(request, { method: "GET", path: "/employees", response: EMPLOYEES });
  await seedResponse(request, {
    method: "GET",
    path: "/carreira/promotabilidade/colab-1",
    response: { status: "amarelo", mesesDeCasa: 14, requisitosPendentes: 0, metasPendentes: 0, metasPdiRegistradas: true, ultimaMediaAvaliacao: null },
  });
  await seedResponse(request, {
    method: "GET",
    path: "/carreira/evaluations",
    response: {
      id: "ev-existing",
      status: "salva",
      mediaGeral: 8.5,
      proximoNivel: "senior",
      principios: [],
      competencias: [],
      requisitos: [
        { tipo: "obrigatorio", label: "3 anos ou mais como Pleno, com graduação completa", atendido: true },
        { tipo: "obrigatorio", label: "Especialização desejável e no mínimo 3 certificações", atendido: true },
        { tipo: "obrigatorio", label: "Soft skills consolidadas e referência técnica", atendido: true },
      ],
    },
  });

  await page.goto("/gestao-carreiras?aba=avaliacao-carreira&userId=colab-1");

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Submeter para Decisão da Diretoria" }).click();

  await page.waitForTimeout(1000);
  const recorded = await getRecordedRequests(request);
  expect(recorded.some((r) => r.method === "POST" && r.path.includes("/decidir"))).toBe(false);
});

test("hides the Submeter button when no evaluation has been saved yet", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request);
  await seedResponse(request, { method: "GET", path: "/employees", response: EMPLOYEES });
  await seedResponse(request, {
    method: "GET",
    path: "/carreira/promotabilidade/colab-1",
    response: { status: "branco", mesesDeCasa: 1, requisitosPendentes: 0, metasPendentes: 0, metasPdiRegistradas: false, ultimaMediaAvaliacao: null },
  });

  await page.goto("/gestao-carreiras?aba=avaliacao-carreira&userId=colab-1");

  await expect(page.getByRole("button", { name: "Submeter para Decisão da Diretoria" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Agendar Reunião de 1:1" })).toBeVisible();
});

test("shows a read-only summary and a blank form when the most recent evaluation is already decidida", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request);
  await seedResponse(request, { method: "GET", path: "/employees", response: EMPLOYEES });
  await seedResponse(request, {
    method: "GET",
    path: "/carreira/promotabilidade/colab-1",
    response: { status: "amarelo", mesesDeCasa: 14, requisitosPendentes: 0, metasPendentes: 0, metasPdiRegistradas: true, ultimaMediaAvaliacao: null },
  });
  await seedResponse(request, {
    method: "GET",
    path: "/carreira/evaluations",
    response: {
      id: "ev-decided",
      status: "decidida",
      resultado: "em_desenvolvimento",
      decidedAt: "2026-08-01T12:00:00.000Z",
      mediaGeral: 5.5,
      proximoNivel: "senior",
      principios: [],
      competencias: [],
      requisitos: [],
    },
  });

  await page.goto("/gestao-carreiras?aba=avaliacao-carreira&userId=colab-1");

  // Both the read-only summary and the (always-present) elegibility badge can
  // legitimately say "Em Desenvolvimento" when there's no open evaluation to
  // drive elegivel — so anchor on the summary's unique lead-in text instead of
  // the ambiguous phrase alone, which would violate Playwright's strict mode.
  await expect(page.getByText("Última avaliação decidida em", { exact: false })).toContainText("Em desenvolvimento");
  await expect(page.getByRole("button", { name: "Submeter para Decisão da Diretoria" })).toHaveCount(0);
  await expect(page.locator('input[name="nota-clareza"]')).toHaveValue("");
});
