"use server";

import { API_URL } from "@/constants/api";

export type RequestResetState = {
  identifier: string | null;
  devCode: string | null;
  error: string | null;
};

export async function requestReset(
  _prevState: RequestResetState,
  formData: FormData,
): Promise<RequestResetState> {
  const identifier = formData.get("identifier");
  if (typeof identifier !== "string" || !identifier) {
    return { identifier: null, devCode: null, error: "Informe seu email ou telefone." };
  }

  const res = await fetch(`${API_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier }),
  });
  if (!res.ok) {
    return { identifier: null, devCode: null, error: "Não foi possível processar o pedido." };
  }

  const data = (await res.json()) as { devCode?: string };
  return { identifier, devCode: data.devCode ?? null, error: null };
}

export type ResetPasswordState = { error: string | null; success: boolean };

export async function resetPassword(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const identifier = formData.get("identifier");
  const code = formData.get("code");
  const newPassword = formData.get("newPassword");
  if (
    typeof identifier !== "string" ||
    !identifier ||
    typeof code !== "string" ||
    !code ||
    typeof newPassword !== "string" ||
    newPassword.length < 8
  ) {
    return {
      error: "Preencha o código e uma nova senha com pelo menos 8 caracteres.",
      success: false,
    };
  }

  const res = await fetch(`${API_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, code, newPassword }),
  });
  if (!res.ok) {
    return { error: "Código inválido ou expirado.", success: false };
  }

  return { error: null, success: true };
}
