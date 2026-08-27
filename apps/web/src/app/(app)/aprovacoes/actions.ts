"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

type Decision = "aprovado" | "recusado";

async function updateStatus(path: string, status: Decision) {
  const res = await apiFetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    throw new Error(`${path} responded with ${res.status}`);
  }
  revalidatePath("/aprovacoes");
}

export async function decideAtestado(formData: FormData) {
  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || (status !== "aprovado" && status !== "recusado")) {
    throw new Error("Invalid form data");
  }
  await updateStatus(`/atestados/${id}/status`, status);
}

export async function decideVacation(formData: FormData) {
  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || (status !== "aprovado" && status !== "recusado")) {
    throw new Error("Invalid form data");
  }
  await updateStatus(`/solicitacoes/ferias/${id}/status`, status);
}

export async function decideAdjustment(formData: FormData) {
  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || (status !== "aprovado" && status !== "recusado")) {
    throw new Error("Invalid form data");
  }
  await updateStatus(`/solicitacoes/ajustes/${id}/status`, status);
}

export async function decideCompensation(formData: FormData) {
  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || (status !== "aprovado" && status !== "recusado")) {
    throw new Error("Invalid form data");
  }
  await updateStatus(`/solicitacoes/compensacoes/${id}/status`, status);
}
