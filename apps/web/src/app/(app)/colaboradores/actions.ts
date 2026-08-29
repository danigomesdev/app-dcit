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

export type CreateEmployeeState = { error: string | null; success: boolean };

const OPTIONAL_FIELDS = [
  "cpf",
  "rg",
  "dataNascimento",
  "estadoCivil",
  "enderecoRua",
  "enderecoNumero",
  "enderecoBairro",
  "enderecoCidade",
  "enderecoEstado",
  "enderecoCep",
] as const;

export async function createEmployee(
  _prevState: CreateEmployeeState,
  formData: FormData
): Promise<CreateEmployeeState> {
  const name = formData.get("name");
  const role = formData.get("role");
  const hireDate = formData.get("hireDate");
  if (typeof name !== "string" || typeof role !== "string" || typeof hireDate !== "string") {
    return { error: "Dados do formulário inválidos.", success: false };
  }

  const payload: Record<string, string | null> = { name, role, hireDate };
  for (const field of OPTIONAL_FIELDS) {
    const value = formData.get(field);
    payload[field] = typeof value === "string" && value !== "" ? value : null;
  }

  const res = await apiFetch("/employees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    if (res.status === 409) {
      return { error: "Já existe um colaborador cadastrado com esse CPF.", success: false };
    }
    return { error: `Não foi possível salvar (código ${res.status}).`, success: false };
  }

  revalidatePath("/colaboradores");
  return { error: null, success: true };
}

export async function deleteEmployee(formData: FormData) {
  const userId = formData.get("userId");
  if (typeof userId !== "string") {
    throw new Error("Invalid form data");
  }
  const res = await apiFetch(`/employees/${userId}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`/employees/${userId} responded with ${res.status}`);
  }
  revalidatePath("/colaboradores");
  revalidatePath("/");
}

export async function restoreEmployee(formData: FormData) {
  const userId = formData.get("userId");
  if (typeof userId !== "string") {
    throw new Error("Invalid form data");
  }
  const res = await apiFetch(`/employees/${userId}/restore`, { method: "PATCH" });
  if (!res.ok) {
    throw new Error(`/employees/${userId}/restore responded with ${res.status}`);
  }
  revalidatePath("/colaboradores");
  revalidatePath("/");
}

export async function permanentlyDeleteEmployee(formData: FormData) {
  const userId = formData.get("userId");
  if (typeof userId !== "string") {
    throw new Error("Invalid form data");
  }
  const res = await apiFetch(`/employees/${userId}/permanent`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`/employees/${userId}/permanent responded with ${res.status}`);
  }
  revalidatePath("/colaboradores");
}
