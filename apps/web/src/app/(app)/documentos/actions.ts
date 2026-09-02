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

export async function submitAtestado(formData: FormData) {
  const cid = formData.get("cid");
  const crm = formData.get("crm");
  const medico = formData.get("medico");
  const diasRaw = formData.get("dias");
  const photo = formData.get("photo");
  const dias = typeof diasRaw === "string" ? Number.parseInt(diasRaw, 10) : NaN;
  if (
    typeof cid !== "string" ||
    cid.trim().length === 0 ||
    typeof crm !== "string" ||
    crm.trim().length === 0 ||
    typeof medico !== "string" ||
    medico.trim().length === 0 ||
    !Number.isInteger(dias) ||
    dias <= 0
  ) {
    throw new Error("Preencha CID, CRM, médico e uma quantidade de dias válida.");
  }
  const res = await apiFetch("/atestados", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cid: cid.trim(),
      crm: crm.trim(),
      medico: medico.trim(),
      dias,
      photoDataUrl: typeof photo === "string" && photo.length > 0 ? photo : undefined,
    }),
  });
  if (!res.ok) {
    throw new Error(`/atestados responded with ${res.status}`);
  }
  revalidatePath("/documentos");
}

export async function runAtestadoOcr(
  base64: string,
  mediaType: string,
): Promise<{ cid: string | null; crm: string | null; medico: string | null; dias: number | null } | null> {
  const res = await apiFetch("/atestados/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mediaType }),
  });
  if (!res.ok) return null;
  return res.json();
}
