"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";
import {
  COMPETENCIA_KEYS,
  PRINCIPIO_KEYS,
  type CompetenciaKey,
  type PrincipioKey,
} from "@ponto-dcit/shared-types";

export async function createCareerGoal(formData: FormData) {
  const userId = formData.get("userId");
  const tipo = formData.get("tipo");
  const title = formData.get("title");
  if (
    typeof userId !== "string" ||
    userId.length === 0 ||
    (tipo !== "pdi" && tipo !== "entrega") ||
    typeof title !== "string" ||
    title.trim().length === 0
  ) {
    throw new Error("Preencha o tipo e um título válido.");
  }
  const res = await apiFetch("/carreira/metas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, tipo, title: title.trim() }),
  });
  if (!res.ok) {
    throw new Error(`/carreira/metas responded with ${res.status}`);
  }
  revalidatePath("/gestao-carreiras");
}

export async function updateCareerGoalStatus(formData: FormData) {
  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || typeof status !== "string") {
    throw new Error("Requisição inválida.");
  }
  const res = await apiFetch(`/carreira/metas/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    throw new Error(`/carreira/metas/${id} responded with ${res.status}`);
  }
  revalidatePath("/gestao-carreiras");
}

export async function createTrackRequirement(formData: FormData) {
  const userId = formData.get("userId");
  const title = formData.get("title");
  if (typeof userId !== "string" || userId.length === 0 || typeof title !== "string" || title.trim().length === 0) {
    throw new Error("Informe um título válido.");
  }
  const res = await apiFetch("/carreira/trilha", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, title: title.trim() }),
  });
  if (!res.ok) {
    throw new Error(`/carreira/trilha responded with ${res.status}`);
  }
  revalidatePath("/gestao-carreiras");
}

export async function updateTrackRequirementStatus(formData: FormData) {
  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || typeof status !== "string") {
    throw new Error("Requisição inválida.");
  }
  const res = await apiFetch(`/carreira/trilha/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    throw new Error(`/carreira/trilha/${id} responded with ${res.status}`);
  }
  revalidatePath("/gestao-carreiras");
}

function parseScore(value: FormDataEntryValue | null): number {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    throw new Error("Notas devem ser de 1 a 5.");
  }
  return parsed;
}

export async function createEvaluation(formData: FormData) {
  const userId = formData.get("userId");
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("userId é obrigatório.");
  }
  const proatividade = parseScore(formData.get("proatividade"));
  const trabalhoEquipe = parseScore(formData.get("trabalhoEquipe"));
  const comunicacao = parseScore(formData.get("comunicacao"));
  const lideranca = parseScore(formData.get("lideranca"));
  const comentario = formData.get("comentario");

  const res = await apiFetch("/carreira/avaliacoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      proatividade,
      trabalhoEquipe,
      comunicacao,
      lideranca,
      comentario: typeof comentario === "string" && comentario.trim().length > 0 ? comentario.trim() : undefined,
    }),
  });
  if (!res.ok) {
    throw new Error(`/carreira/avaliacoes responded with ${res.status}`);
  }
  revalidatePath("/gestao-carreiras");
}

export async function createNineBoxPlacement(formData: FormData) {
  const userId = formData.get("userId");
  const desempenho = formData.get("desempenho");
  const potencial = formData.get("potencial");
  if (
    typeof userId !== "string" ||
    userId.length === 0 ||
    (desempenho !== "baixo" && desempenho !== "medio" && desempenho !== "alto") ||
    (potencial !== "baixo" && potencial !== "medio" && potencial !== "alto")
  ) {
    throw new Error("Selecione desempenho e potencial.");
  }
  const res = await apiFetch("/carreira/nine-box", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, desempenho, potencial }),
  });
  if (!res.ok) {
    throw new Error(`/carreira/nine-box responded with ${res.status}`);
  }
  revalidatePath("/gestao-carreiras");
}

export async function createOneOnOne(formData: FormData) {
  const userId = formData.get("userId");
  const pauta = formData.get("pauta");
  const acoesRaw = formData.get("acoes");
  if (typeof userId !== "string" || userId.length === 0 || typeof pauta !== "string" || pauta.trim().length === 0) {
    throw new Error("Informe a pauta.");
  }
  const acoes =
    typeof acoesRaw === "string" && acoesRaw.trim().length > 0
      ? acoesRaw
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .map((descricao) => ({ descricao }))
      : [];

  const res = await apiFetch("/carreira/one-on-ones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, pauta: pauta.trim(), acoes }),
  });
  if (!res.ok) {
    throw new Error(`/carreira/one-on-ones responded with ${res.status}`);
  }
  revalidatePath("/gestao-carreiras");
}

export async function updateOneOnOneAcaoStatus(formData: FormData) {
  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || typeof status !== "string") {
    throw new Error("Requisição inválida.");
  }
  const res = await apiFetch(`/carreira/one-on-ones/acoes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    throw new Error(`/carreira/one-on-ones/acoes/${id} responded with ${res.status}`);
  }
  revalidatePath("/gestao-carreiras");
}

function parseNota10(value: FormDataEntryValue | null): number {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10) {
    throw new Error("Notas devem ser de 0 a 10.");
  }
  return parsed;
}

function readOptionalText(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export async function saveCareerEvaluation(formData: FormData) {
  const userId = formData.get("userId");
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("userId é obrigatório.");
  }
  const principios = (PRINCIPIO_KEYS as readonly PrincipioKey[]).map((key) => ({
    principio: key,
    nota: parseNota10(formData.get(`nota-${key}`)),
    justificativa: readOptionalText(formData.get(`justificativa-${key}`)),
  }));
  const competencias = (COMPETENCIA_KEYS as readonly CompetenciaKey[]).map((key) => ({
    competencia: key,
    nota: parseNota10(formData.get(`nota-${key}`)),
  }));
  const requisitosAtendidos = formData
    .getAll("requisitosAtendidos")
    .filter((value): value is string => typeof value === "string");

  const res = await apiFetch("/carreira/evaluations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, principios, competencias, requisitosAtendidos }),
  });
  if (!res.ok) {
    throw new Error(`/carreira/evaluations responded with ${res.status}`);
  }
  revalidatePath("/gestao-carreiras");
}

export async function decidirCareerEvaluation(formData: FormData) {
  const id = formData.get("id");
  const confirmarPromocao = formData.get("confirmarPromocao") === "true";
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Requisição inválida.");
  }
  const res = await apiFetch(`/carreira/evaluations/${id}/decidir`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmarPromocao }),
  });
  if (!res.ok) {
    throw new Error(`/carreira/evaluations/${id}/decidir responded with ${res.status}`);
  }
  revalidatePath("/gestao-carreiras");
}
