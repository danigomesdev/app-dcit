"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

type Decision = "aprovado" | "recusado";

async function updateStatus(path: string, status: Decision, reviewNote?: string) {
  const res = await apiFetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, reviewNote }),
  });
  if (!res.ok) {
    throw new Error(`${path} responded with ${res.status}`);
  }
  revalidatePath("/aprovacoes");
}

function readDecision(formData: FormData): { id: string; status: Decision; reviewNote?: string } {
  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || (status !== "aprovado" && status !== "recusado")) {
    throw new Error("Invalid form data");
  }
  const reviewNote = formData.get("reviewNote");
  return { id, status, reviewNote: typeof reviewNote === "string" ? reviewNote : undefined };
}

export async function decideAtestado(formData: FormData) {
  const { id, status, reviewNote } = readDecision(formData);
  await updateStatus(`/atestados/${id}/status`, status, reviewNote);
}

export async function decideVacation(formData: FormData) {
  const { id, status, reviewNote } = readDecision(formData);
  await updateStatus(`/solicitacoes/ferias/${id}/status`, status, reviewNote);
}

export async function decideAdjustment(formData: FormData) {
  const { id, status, reviewNote } = readDecision(formData);
  await updateStatus(`/solicitacoes/ajustes/${id}/status`, status, reviewNote);
}

export async function decideCompensation(formData: FormData) {
  const { id, status, reviewNote } = readDecision(formData);
  await updateStatus(`/solicitacoes/compensacoes/${id}/status`, status, reviewNote);
}
