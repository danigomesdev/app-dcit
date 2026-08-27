"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export async function addShift(formData: FormData) {
  const date = formData.get("date");
  const label = formData.get("label");
  const userId = formData.get("userId");
  if (typeof date !== "string" || typeof label !== "string" || typeof userId !== "string") {
    throw new Error("Invalid form data");
  }
  const res = await apiFetch("/operacional/escala", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, label, userId }),
  });
  if (!res.ok) {
    throw new Error(`/operacional/escala responded with ${res.status}`);
  }
  revalidatePath("/escala");
}

export async function removeShift(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") {
    throw new Error("Invalid form data");
  }
  const res = await apiFetch(`/operacional/escala/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`/operacional/escala/${id} responded with ${res.status}`);
  }
  revalidatePath("/escala");
}
