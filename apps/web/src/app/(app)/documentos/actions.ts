"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export async function getAtestadoPhoto(id: string): Promise<string | null> {
  const res = await apiFetch(`/atestados/${id}/photo`);
  if (!res.ok) {
    throw new Error(`/atestados/${id}/photo responded with ${res.status}`);
  }
  const data = (await res.json()) as { photoDataUrl: string | null };
  return data.photoDataUrl;
}

export async function submitAdmissionDocument(formData: FormData) {
  const title = formData.get("title");
  if (typeof title !== "string" || title.trim().length === 0) {
    throw new Error("Título é obrigatório.");
  }
  const photo = formData.get("photo");
  const res = await apiFetch("/documentos/admissionais", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: title.trim(),
      photoUri: typeof photo === "string" && photo.length > 0 ? photo : undefined,
    }),
  });
  if (!res.ok) {
    throw new Error(`/documentos/admissionais responded with ${res.status}`);
  }
  revalidatePath("/documentos");
}

export async function submitCertification(formData: FormData) {
  const name = formData.get("name");
  const institution = formData.get("institution");
  const validUntil = formData.get("validUntil");
  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    typeof institution !== "string" ||
    institution.trim().length === 0 ||
    typeof validUntil !== "string" ||
    !/^\d{2}\/\d{2}\/\d{4}$/.test(validUntil)
  ) {
    throw new Error("Preencha nome, instituição e uma data válida (DD/MM/AAAA).");
  }
  const res = await apiFetch("/documentos/certificacoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim(), institution: institution.trim(), validUntil }),
  });
  if (!res.ok) {
    throw new Error(`/documentos/certificacoes responded with ${res.status}`);
  }
  revalidatePath("/documentos");
}
