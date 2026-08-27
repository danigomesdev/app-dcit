import type { BrowserContext } from "@playwright/test";

// Fixture JWT for e2e tests: real header/signature aren't checked by the
// web app (proxy.ts only checks the cookie's presence; getSession() decodes
// the payload without verifying the signature — see apps/web/src/lib/session.ts
// for why that's safe: it's display-only, the API re-verifies on every call).
function fakeSessionToken(claims: { sub: string; role: string; name: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.fixture-signature`;
}

export async function addSessionCookie(
  context: BrowserContext,
  claims: { sub: string; role: string; name: string } = {
    sub: "gestor-1",
    role: "gestor",
    name: "Bruno Gestor",
  }
) {
  await context.addCookies([
    {
      name: "ponto_session",
      value: fakeSessionToken(claims),
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
