"use server";

import { apiFetch } from "@/lib/api";

export async function markNotificationRead(id: string): Promise<void> {
  const res = await apiFetch(`/notifications/${id}/read`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`/notifications/${id}/read responded with ${res.status}`);
  }
}
