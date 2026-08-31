"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { API_URL } from "@/constants/api";
import { SESSION_COOKIE } from "@/lib/session";

export type LoginState = { error: string | null };

export async function loginWithPassword(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "Preencha email e senha." };
  }

  const res = await fetch(`${API_URL}/auth/password-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, origin: "web" }),
  });

  if (!res.ok) {
    return { error: "Email ou senha incorretos." };
  }

  const data = (await res.json()) as { token: string };
  (await cookies()).set(SESSION_COOKIE, data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 8 * 60 * 60,
  });
  redirect("/");
}
