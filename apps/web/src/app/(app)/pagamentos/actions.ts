"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export async function sendPagamento(category: string, userIds: string[]) {
  const res = await apiFetch("/notifications/pagamentos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, userIds }),
  });
  if (!res.ok) {
    throw new Error(`/notifications/pagamentos responded with ${res.status}`);
  }
  revalidatePath("/pagamentos");
}
