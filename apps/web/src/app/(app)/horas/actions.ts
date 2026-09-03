"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export async function lancarHoras(formData: FormData) {
  const userId = formData.get("userId");
  const date = formData.get("date");
  const horasTrabalhadasRaw = formData.get("horasTrabalhadas");
  const horasTicketsRaw = formData.get("horasTickets");

  if (
    typeof userId !== "string" ||
    userId.length === 0 ||
    typeof date !== "string" ||
    date.length === 0 ||
    typeof horasTrabalhadasRaw !== "string" ||
    typeof horasTicketsRaw !== "string"
  ) {
    throw new Error("Preencha colaborador, data e as duas quantidades de horas.");
  }

  const horasTrabalhadas = Number(horasTrabalhadasRaw);
  const horasTickets = Number(horasTicketsRaw);
  if (!Number.isFinite(horasTrabalhadas) || horasTrabalhadas < 0 || !Number.isFinite(horasTickets) || horasTickets < 0) {
    throw new Error("Horas devem ser números maiores ou iguais a zero.");
  }

  const res = await apiFetch("/horas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, date, horasTrabalhadas, horasTickets }),
  });
  if (!res.ok) {
    throw new Error(`/horas responded with ${res.status}`);
  }
  revalidatePath("/horas");
}

export async function excluirLancamento(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") {
    throw new Error("Invalid form data");
  }
  const res = await apiFetch(`/horas/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`/horas/${id} responded with ${res.status}`);
  }
  revalidatePath("/horas");
}
