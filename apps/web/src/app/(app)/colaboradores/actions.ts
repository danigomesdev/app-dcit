"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export type UpdateScheduleState = { error: string | null };

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export async function updateSchedule(
  _prevState: UpdateScheduleState,
  formData: FormData
): Promise<UpdateScheduleState> {
  const userId = formData.get("userId");
  const rawExpectedStartTime = formData.get("expectedStartTime");
  if (typeof userId !== "string" || typeof rawExpectedStartTime !== "string") {
    return { error: "Dados do formulário inválidos." };
  }

  const expectedStartTime = rawExpectedStartTime === "" ? null : rawExpectedStartTime;
  if (expectedStartTime !== null && !TIME_PATTERN.test(expectedStartTime)) {
    return { error: "Horário inválido. Use o formato HH:mm." };
  }

  const res = await apiFetch(`/employees/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedStartTime }),
  });
  if (!res.ok) {
    return { error: `Não foi possível salvar (código ${res.status}).` };
  }

  revalidatePath("/colaboradores");
  revalidatePath("/");
  return { error: null };
}
