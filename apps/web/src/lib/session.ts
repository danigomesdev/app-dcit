import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "ponto_session";

export type Session = {
  sub: string;
  role: "colaborador" | "gestor" | "rh";
  name: string;
};

// Decode-only, no signature check: this is display data (name/role in the
// sidebar), not an authorization decision. Every protected call to the API
// re-verifies the JWT's signature server-side — that's the actual security
// boundary, matching the app's backend-for-frontend design.
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  const payload = token.split(".")[1];
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function logout() {
  "use server";
  // The JWT session is stateless (no server-side record to invalidate), so
  // clearing the cookie here is the entire logout — no need to round-trip
  // through the API's POST /auth/logout for this.
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
