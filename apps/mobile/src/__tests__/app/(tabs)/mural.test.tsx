import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";

const POSTS = [
  {
    id: "1",
    glyph: "🎉",
    title: "Bem-vindo(a), Marina!",
    body: "A equipe de Suporte ganhou uma nova integrante. Dê as boas-vindas!",
    createdAt: "2026-08-25T09:00:00.000Z",
    reactionCount: 12,
    reacted: false,
  },
  {
    id: "3",
    glyph: "🏆",
    title: "Resultado do trimestre",
    body: "Batemos a meta de satisfação dos clientes em 96%. Parabéns a todos!",
    createdAt: "2026-08-12T09:00:00.000Z",
    reactionCount: 24,
    reacted: false,
  },
];

const BIRTHDAYS = [
  { name: "Ana Colaboradora", day: 26, month: 8 },
  { name: "Bruno Gestor", day: 30, month: 8 },
  { name: "Carla RH", day: 14, month: 9 },
];

describe("mural screen", () => {
  beforeEach(async () => {
    globalThis.fetch = jest.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (typeof url === "string" && url.includes("/react")) {
        return Promise.resolve({ ok: true, json: async () => ({ reactionCount: 13, reacted: true }) });
      }
      if (typeof url === "string" && url.endsWith("/mural/birthdays")) {
        return Promise.resolve({ ok: true, json: async () => BIRTHDAYS });
      }
      return Promise.resolve({ ok: true, json: async () => POSTS });
    });
    await saveSessionToken("test-token");
  });

  it("highlights today's birthday and lists the rest of the month", async () => {
    renderRouter("src/app", { initialUrl: "/mural" });

    await waitFor(() => {
      expect(screen.getByText("Aniversariante(s) de hoje")).toBeTruthy();
    });
    expect(screen.getByText("Ana Colaboradora")).toBeTruthy();
    expect(screen.getByText(/Bruno Gestor/)).toBeTruthy();
  });

  it("renders the feed newest-first with a welcome post", async () => {
    renderRouter("src/app", { initialUrl: "/mural" });

    await waitFor(() => {
      expect(screen.getByText("Bem-vindo(a), Marina!")).toBeTruthy();
    });
    expect(screen.getByText("Resultado do trimestre")).toBeTruthy();
  });

  it("toggles a reaction and updates the count", async () => {
    renderRouter("src/app", { initialUrl: "/mural" });

    await waitFor(() => {
      expect(screen.getByText("12")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("12"));

    await waitFor(() => {
      expect(screen.getByText("13")).toBeTruthy();
    });
  });
});
