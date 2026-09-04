"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export async function toggleMuralReaction(formData: FormData) {
  const postId = formData.get("postId");
  if (typeof postId !== "string" || postId.length === 0) {
    throw new Error("postId é obrigatório.");
  }
  const res = await apiFetch(`/mural/posts/${encodeURIComponent(postId)}/react`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`/mural/posts/${postId}/react responded with ${res.status}`);
  }
  revalidatePath("/mural");
}

export type MuralPostState = { error: string | null; success: boolean; successToken: number };

export async function createMuralPost(
  _prevState: MuralPostState,
  formData: FormData
): Promise<MuralPostState> {
  const glyph = formData.get("glyph");
  const title = formData.get("title");
  const body = formData.get("body");
  if (typeof glyph !== "string" || typeof title !== "string" || typeof body !== "string") {
    return { error: "Dados do formulário inválidos.", success: false, successToken: _prevState.successToken };
  }

  const res = await apiFetch("/mural/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ glyph, title, body }),
  });
  if (!res.ok) {
    return {
      error: `Não foi possível publicar (código ${res.status}).`,
      success: false,
      successToken: _prevState.successToken,
    };
  }

  revalidatePath("/mural");
  return { error: null, success: true, successToken: Date.now() };
}
