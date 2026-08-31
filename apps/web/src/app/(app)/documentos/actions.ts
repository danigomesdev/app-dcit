"use server";

import { apiFetch } from "@/lib/api";

export async function getAtestadoPhoto(id: string): Promise<string | null> {
  const res = await apiFetch(`/atestados/${id}/photo`);
  if (!res.ok) {
    throw new Error(`/atestados/${id}/photo responded with ${res.status}`);
  }
  const data = (await res.json()) as { photoDataUrl: string | null };
  return data.photoDataUrl;
}
