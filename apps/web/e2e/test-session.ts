import type { APIRequestContext, BrowserContext } from "@playwright/test";

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

const FAKE_API_URL = "http://localhost:3000";

// Several (app) pages fetch server-side, in the Next.js Node process — never
// in the browser — so page/context.route() can't intercept them (that only
// catches browser-originated requests). apps/web's dev server always talks
// to a real HTTP server at API_URL, so e2e/fake-api-server.mjs *is* that
// server during tests (wired up as a second Playwright webServer). These
// helpers drive its seed/reset/requests control endpoints over Playwright's
// `request` fixture, a real HTTP client independent of the browser.
export async function mockApi(
  request: APIRequestContext,
  data: {
    atestados?: unknown[];
    vacations?: unknown[];
    adjustments?: unknown[];
    compensations?: unknown[];
    team?: unknown[];
    shifts?: unknown[];
    employees?: unknown[];
  } = {}
) {
  await request.post(`${FAKE_API_URL}/__reset`);
  if (data.atestados) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/atestados/team", response: data.atestados },
    });
  }
  if (data.vacations) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/solicitacoes/ferias/todas", response: data.vacations },
    });
  }
  if (data.adjustments) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/solicitacoes/ajustes/todas", response: data.adjustments },
    });
  }
  if (data.compensations) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/solicitacoes/compensacoes/todas", response: data.compensations },
    });
  }
  if (data.team) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/time-entries/team", response: data.team },
    });
  }
  if (data.shifts) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/operacional/escala", response: data.shifts },
    });
  }
  if (data.employees) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/employees", response: data.employees },
    });
  }
}

export async function getRecordedRequests(
  request: APIRequestContext
): Promise<Array<{ method: string; path: string; body: unknown }>> {
  const res = await request.get(`${FAKE_API_URL}/__requests`);
  return res.json();
}
