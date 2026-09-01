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
