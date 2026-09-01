"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export async function toggleMuralReaction(formData: FormData) {
  const postId = formData.get("postId");
  if (typeof postId !== "string" || postId.length === 0) {
    throw new Error("postId é obrigatório.");
  }
  const res = await apiFetch(`/mural/posts/${postId}/react`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`/mural/posts/${postId}/react responded with ${res.status}`);
  }
  revalidatePath("/mural");
}
