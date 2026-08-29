"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export type ConvencaoState = { error: string | null; success: boolean; successToken: number };

function buildPayload(formData: FormData): Record<string, string | null> | null {
  const nome = formData.get("nome");
  const expectedDailyMinutes = formData.get("expectedDailyMinutes");
  const overtimePercent = formData.get("overtimePercent");
  if (
    typeof nome !== "string" ||
    typeof expectedDailyMinutes !== "string" ||
    typeof overtimePercent !== "string"
  ) {
    return null;
  }

  const cnpj = formData.get("cnpj");
  const categoriaSindical = formData.get("categoriaSindical");
  return {
    nome,
    expectedDailyMinutes,
    overtimePercent,
    cnpj: typeof cnpj === "string" && cnpj !== "" ? cnpj : null,
    categoriaSindical:
      typeof categoriaSindical === "string" && categoriaSindical !== "" ? categoriaSindical : null,
  };
}

export async function createConvencao(
  _prevState: ConvencaoState,
  formData: FormData
): Promise<ConvencaoState> {
  const payload = buildPayload(formData);
  if (!payload) {
    return { error: "Dados do formulário inválidos.", success: false, successToken: _prevState.successToken };
  }

  const res = await apiFetch("/convencoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    return {
      error: `Não foi possível salvar (código ${res.status}).`,
      success: false,
      successToken: _prevState.successToken,
    };
  }

  revalidatePath("/convencoes");
  return { error: null, success: true, successToken: Date.now() };
}

export async function updateConvencao(
  _prevState: ConvencaoState,
  formData: FormData
): Promise<ConvencaoState> {
  const id = formData.get("id");
  const payload = buildPayload(formData);
  if (typeof id !== "string" || !payload) {
    return { error: "Dados do formulário inválidos.", success: false, successToken: _prevState.successToken };
  }

  const res = await apiFetch(`/convencoes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    return {
      error: `Não foi possível salvar (código ${res.status}).`,
      success: false,
      successToken: _prevState.successToken,
    };
  }

  revalidatePath("/convencoes");
  return { error: null, success: true, successToken: Date.now() };
}

export async function deleteConvencao(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") {
    throw new Error("Invalid form data");
  }
  const res = await apiFetch(`/convencoes/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`/convencoes/${id} responded with ${res.status}`);
  }
  revalidatePath("/convencoes");
}
