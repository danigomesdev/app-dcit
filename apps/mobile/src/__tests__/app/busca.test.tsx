import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";

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

    expect(screen.getByText("Busque no seu conteúdo")).toBeTruthy();
  });

  it("filters results as the user types and finds a mural post", async () => {
    renderRouter("src/app", { initialUrl: "/busca" });

    fireEvent.changeText(
      screen.getByPlaceholderText("Buscar documentos, atestados, avisos..."),
      "clube de vantagens",
    );

    await waitFor(() => {
      expect(screen.getByText("Nova parceria no clube de vantagens")).toBeTruthy();
    });
  });

  it("shows an empty state when nothing matches", () => {
    renderRouter("src/app", { initialUrl: "/busca" });

    fireEvent.changeText(
      screen.getByPlaceholderText("Buscar documentos, atestados, avisos..."),
      "xyzxyzxyz",
    );

    expect(screen.getByText("Nada encontrado")).toBeTruthy();
  });
});
