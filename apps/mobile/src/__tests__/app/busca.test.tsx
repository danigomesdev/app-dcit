import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";

const BASE64URL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function base64UrlEncode(value: string): string {
  const bytes = encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
  let bits = "";
  for (let i = 0; i < bytes.length; i++) {
    bits += bytes.charCodeAt(i).toString(2).padStart(8, "0");
  }
  let output = "";
  for (let i = 0; i + 6 <= bits.length; i += 6) {
    output += BASE64URL_CHARS[parseInt(bits.slice(i, i + 6), 2)];
  }
  const remainder = bits.length % 6;
  if (remainder) {
    output += BASE64URL_CHARS[parseInt(bits.slice(-remainder).padEnd(6, "0"), 2)];
  }
  return output;
}

function fakeJwt(claims: Record<string, unknown>) {
  return `${base64UrlEncode("{}")}.${base64UrlEncode(JSON.stringify(claims))}.signature`;
}

const MURAL_POSTS = [
  {
    id: "2",
    glyph: "🎁",
    title: "Nova parceria no clube de vantagens",
    body: "Academia Smart Fit agora com 20% de desconto para colaboradores DCIT. Confira no app.",
    createdAt: "2026-08-20T09:00:00.000Z",
    reactionCount: 8,
    reacted: false,
  },
];

describe("busca screen", () => {
  beforeEach(async () => {
    globalThis.fetch = jest.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.endsWith("/mural/posts")) {
        return Promise.resolve({ ok: true, json: async () => MURAL_POSTS });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });
    await saveSessionToken("test-token");
  });

  it("shows a prompt before typing anything", () => {
    renderRouter("src/app", { initialUrl: "/busca" });

    expect(screen.getByText("Busque em qualquer lugar do app")).toBeTruthy();
  });

  it("filters results as the user types and finds a mural post", async () => {
    renderRouter("src/app", { initialUrl: "/busca" });

    fireEvent.changeText(
      screen.getByPlaceholderText("Buscar telas, documentos, atestados, avisos..."),
      "clube de vantagens",
    );

    await waitFor(() => {
      expect(screen.getByText("Nova parceria no clube de vantagens")).toBeTruthy();
    });
  });

  it("shows an empty state when nothing matches", () => {
    renderRouter("src/app", { initialUrl: "/busca" });

    fireEvent.changeText(
      screen.getByPlaceholderText("Buscar telas, documentos, atestados, avisos..."),
      "xyzxyzxyz",
    );

    expect(screen.getByText("Nada encontrado")).toBeTruthy();
  });

  it("finds an app screen by name and navigates to it", async () => {
    renderRouter("src/app", { initialUrl: "/busca" });

    fireEvent.changeText(
      screen.getByPlaceholderText("Buscar telas, documentos, atestados, avisos..."),
      "banco de horas",
    );
    await waitFor(() => {
      expect(screen.getByText("Banco de Horas")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Banco de Horas"));

    await waitFor(() => {
      expect(screen).toHavePathname("/banco-de-horas");
    });
  });

  it("finds a screen by keyword even when the word isn't in its title", async () => {
    renderRouter("src/app", { initialUrl: "/busca" });

    fireEvent.changeText(
      screen.getByPlaceholderText("Buscar telas, documentos, atestados, avisos..."),
      "hora extra",
    );

    await waitFor(() => {
      expect(screen.getByText("Banco de Horas")).toBeTruthy();
    });
  });

  it("hides gestor/RH-only screens from a colaborador's results", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));
    renderRouter("src/app", { initialUrl: "/busca" });

    fireEvent.changeText(
      screen.getByPlaceholderText("Buscar telas, documentos, atestados, avisos..."),
      "atestados da equipe",
    );

    await waitFor(() => {
      expect(screen.getByText("Nada encontrado")).toBeTruthy();
    });
  });

  it("shows the team atestados screen to a gestor", async () => {
    await saveSessionToken(fakeJwt({ sub: "gestor-1", role: "gestor", name: "Bruno" }));
    renderRouter("src/app", { initialUrl: "/busca" });

    fireEvent.changeText(
      screen.getByPlaceholderText("Buscar telas, documentos, atestados, avisos..."),
      "atestados da equipe",
    );

    await waitFor(() => {
      expect(screen.getByText("Atestados da equipe")).toBeTruthy();
    });
  });
});
