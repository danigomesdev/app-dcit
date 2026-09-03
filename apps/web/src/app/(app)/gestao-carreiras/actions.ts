"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

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
