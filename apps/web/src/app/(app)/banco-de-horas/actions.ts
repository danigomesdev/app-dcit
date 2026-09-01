"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export async function requestCompensation(formData: FormData) {
  const reason = formData.get("reason");
  if (typeof reason !== "string" || reason.trim().length === 0) {
    throw new Error("Motivo é obrigatório.");
  }
  const res = await apiFetch("/solicitacoes/compensacoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    throw new Error(`/solicitacoes/compensacoes responded with ${res.status}`);
  }
  revalidatePath("/banco-de-horas");
}
