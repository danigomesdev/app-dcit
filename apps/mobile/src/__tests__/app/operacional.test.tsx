import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";

describe("operacional screen", () => {
  beforeEach(async () => {
    let sobreavisoActive = false;
    globalThis.fetch = jest.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (typeof url === "string" && url.endsWith("/operacional/sobreaviso/toggle")) {
        sobreavisoActive = !sobreavisoActive;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            active: sobreavisoActive,
            startedAt: sobreavisoActive ? new Date().toISOString() : null,
          }),
        });
      }
      if (typeof url === "string" && url.endsWith("/operacional/sobreaviso")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ active: sobreavisoActive, startedAt: null }),
        });
      }
      if (typeof url === "string" && url.endsWith("/operacional/deslocamentos")) {
        if (options?.method === "POST") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: "1",
              startedAt: new Date().toISOString(),
              endedAt: new Date().toISOString(),
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });
    await saveSessionToken("test-token");
  });

  it("shows the plantão schedule for the week", () => {
    renderRouter("src/app", { initialUrl: "/operacional" });

    expect(screen.getByText("Segunda")).toBeTruthy();
    expect(screen.getAllByText("Bruno Gestor").length).toBeGreaterThan(0);
  });

  it("toggles sobreaviso on and off", async () => {
    renderRouter("src/app", { initialUrl: "/operacional" });

    await waitFor(() => {
      expect(screen.getByText("Sobreaviso inativo")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Ativar sobreaviso"));
    await waitFor(() => {
      expect(screen.getByText("Sobreaviso ativo")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Encerrar sobreaviso"));
    await waitFor(() => {
      expect(screen.getByText("Sobreaviso inativo")).toBeTruthy();
    });
  });

  it("tracks a deslocamento session from start to finish", async () => {
    renderRouter("src/app", { initialUrl: "/operacional" });

    await waitFor(() => {
      expect(screen.getByText("Sem deslocamento em andamento")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Iniciar deslocamento"));
    expect(screen.getByText("Em deslocamento")).toBeTruthy();

    fireEvent.press(screen.getByText("Encerrar deslocamento"));
    await waitFor(() => {
      expect(screen.getByText("Sem deslocamento em andamento")).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByText("Deslocamentos recentes")).toBeTruthy();
    });
  });
});
