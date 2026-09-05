"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";
import {
  COMPETENCIA_KEYS,
  PRINCIPIO_KEYS,
  type CompetenciaKey,
  type PrincipioKey,
} from "@ponto-dcit/shared-types";

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
    justificativa: readOptionalText(formData.get(`justificativa-${key}`)),
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
