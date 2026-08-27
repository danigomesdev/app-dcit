// A minimal stand-in for apps/api, used only by the Playwright e2e suite.
// The real reason this exists: apps/web's data fetching for pages like
// /aprovacoes runs server-side (in the Next.js Node process), never in the
// browser — so Playwright's page/context.route() (which only intercepts
// browser-originated requests) can't mock it. Running a real HTTP server on
// the port the Next app calls is the only thing that actually intercepts
// those calls. Tests seed/reset it over a small control API (__seed,
// __requests, __reset) via Playwright's `request` fixture.
import http from "node:http";

const PORT = process.env.PORT || 3000;

let seeded = {};
let recordedRequests = [];

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const body = await readBody(req).catch(() => undefined);

  if (req.method === "POST" && url.pathname === "/__seed") {
    seeded[body.path] = body.response;
    return sendJson(res, 204, null);
  }

  if (req.method === "POST" && url.pathname === "/__reset") {
    seeded = {};
    recordedRequests = [];
    return sendJson(res, 204, null);
  }

  if (req.method === "GET" && url.pathname === "/__requests") {
    return sendJson(res, 200, recordedRequests);
  }

  recordedRequests.push({ method: req.method, path: url.pathname, body });

  if (req.method === "GET" && url.pathname in seeded) {
    return sendJson(res, 200, seeded[url.pathname]);
  }
  if (req.method === "GET" && url.pathname === "/atestados/team") {
    return sendJson(res, 200, []);
  }
  if (
    req.method === "GET" &&
    [
      "/solicitacoes/ferias/todas",
      "/solicitacoes/ajustes/todas",
      "/solicitacoes/compensacoes/todas",
    ].includes(url.pathname)
  ) {
    return sendJson(res, 200, []);
  }
  if (req.method === "GET" && url.pathname === "/time-entries/team") {
    return sendJson(res, 200, []);
  }
  if (req.method === "GET" && url.pathname === "/operacional/escala") {
    return sendJson(res, 200, []);
  }
  if (req.method === "GET" && url.pathname === "/employees") {
    return sendJson(res, 200, []);
  }
  if (
    req.method === "GET" &&
    ["/mural/posts", "/mural/birthdays"].includes(url.pathname)
  ) {
    return sendJson(res, 200, []);
  }
  if (
    req.method === "GET" &&
    ["/beneficios/saldos/equipe", "/beneficios/parceiros"].includes(url.pathname)
  ) {
    return sendJson(res, 200, []);
  }
  if (req.method === "GET" && url.pathname === "/onboarding/equipe") {
    return sendJson(res, 200, []);
  }
  if (
    req.method === "GET" &&
    ["/operacional/sobreaviso/equipe", "/operacional/deslocamentos/equipe"].includes(
      url.pathname
    )
  ) {
    return sendJson(res, 200, []);
  }
  if (
    req.method === "GET" &&
    ["/documentos/admissionais/equipe", "/documentos/certificacoes/equipe"].includes(
      url.pathname
    )
  ) {
    return sendJson(res, 200, []);
  }
  if (req.method === "POST" && url.pathname === "/operacional/escala") {
    return sendJson(res, 201, { id: "generated-id", ...body });
  }
  if (req.method === "DELETE" && /^\/operacional\/escala\/[^/]+$/.test(url.pathname)) {
    return sendJson(res, 204, null);
  }
  if (
    req.method === "PATCH" &&
    /^\/(atestados|solicitacoes\/(ferias|ajustes|compensacoes))\/[^/]+\/status$/.test(
      url.pathname
    )
  ) {
    return sendJson(res, 200, { ...body });
  }

  sendJson(res, 404, { error: `no fake-api handler for ${req.method} ${url.pathname}` });
});

server.listen(PORT, () => {
  console.log(`Fake API server listening at http://localhost:${PORT}`);
});
