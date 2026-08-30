"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export type HoleriteState = { error: string | null; success: boolean; successToken: number };

function buildPayload(formData: FormData): Record<string, string> | null {
  const label = formData.get("label");
  const gross = formData.get("gross");
  const inss = formData.get("inss");
  const irrf = formData.get("irrf");
  const benefits = formData.get("benefits");
  if (
    typeof label !== "string" ||
    typeof gross !== "string" ||
    typeof inss !== "string" ||
    typeof irrf !== "string" ||
    typeof benefits !== "string"
  ) {
    return null;
  }
  return { label, gross, inss, irrf, benefits };
}

export async function createHolerite(
  _prevState: HoleriteState,
  formData: FormData
): Promise<HoleriteState> {
  const userId = formData.get("userId");
  const payload = buildPayload(formData);
  if (typeof userId !== "string" || !userId || !payload) {
    return {
      error: "Dados do formulário inválidos.",
      success: false,
      successToken: _prevState.successToken,
    };
  }

  const res = await apiFetch("/documentos/holerites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...payload }),
  });
  if (!res.ok) {
    return {
      error: `Não foi possível salvar (código ${res.status}).`,
      success: false,
      successToken: _prevState.successToken,
    };
  }

  revalidatePath("/holerites");
  return { error: null, success: true, successToken: Date.now() };
}

export async function updateHolerite(
  _prevState: HoleriteState,
  formData: FormData
): Promise<HoleriteState> {
  const id = formData.get("id");
  const payload = buildPayload(formData);
  if (typeof id !== "string" || !payload) {
    return {
      error: "Dados do formulário inválidos.",
      success: false,
      successToken: _prevState.successToken,
    };
  }

  const res = await apiFetch(`/documentos/holerites/${id}`, {
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

  revalidatePath("/holerites");
  return { error: null, success: true, successToken: Date.now() };
}

export async function deleteHolerite(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") {
    throw new Error("Invalid form data");
  }
  const res = await apiFetch(`/documentos/holerites/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`/documentos/holerites/${id} responded with ${res.status}`);
  }
  revalidatePath("/holerites");
}
