"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

function daysBetweenInclusive(startDate: string, endDate: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
  return Math.round((end - start) / msPerDay) + 1;
}

export async function requestVacation(formData: FormData) {
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");
  if (typeof startDate !== "string" || typeof endDate !== "string" || !startDate || !endDate) {
    throw new Error("Data de início e fim são obrigatórias.");
  }
  if (endDate < startDate) {
    throw new Error("A data de fim não pode ser anterior à data de início.");
  }
  const res = await apiFetch("/solicitacoes/ferias", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startDate, endDate, days: daysBetweenInclusive(startDate, endDate) }),
  });
  if (!res.ok) {
    throw new Error(`/solicitacoes/ferias responded with ${res.status}`);
  }
  revalidatePath("/ferias");
}
