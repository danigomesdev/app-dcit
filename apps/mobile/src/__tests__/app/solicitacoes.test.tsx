import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";

type StoredRequest = { id: string; reason: string; status: string; createdAt: string };

describe("solicitacoes screen", () => {
  let stored: StoredRequest[];

  beforeEach(async () => {
    stored = [];
    globalThis.fetch = jest.fn((_url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        const body = JSON.parse(options.body as string) as { reason: string };
        const record: StoredRequest = {
          id: String(stored.length + 1),
          reason: body.reason,
          status: "pendente",
          createdAt: new Date().toISOString(),
        };
        stored.push(record);
        return Promise.resolve({ ok: true, json: async () => record });
      }
      return Promise.resolve({ ok: true, json: async () => stored });
    }) as jest.Mock;
    await saveSessionToken("test-token");
  });

  it("shows an empty state with no requests yet", async () => {
    renderRouter("src/app", { initialUrl: "/solicitacoes" });

    await waitFor(() => {
      expect(screen.getByText("Nenhuma solicitação ainda")).toBeTruthy();
    });
  });

  it("submits a request from Ajustar meu ponto", async () => {
    renderRouter("src/app", { initialUrl: "/ajustar" });

    fireEvent.changeText(
      screen.getByPlaceholderText("Ex: esqueci de bater o ponto de saída às 18h"),
      "Esqueci de bater o ponto de saída ontem",
    );
    fireEvent.press(screen.getByText("Enviar solicitação"));

    await waitFor(() => {
      expect(
        screen.getByText("Solicitação enviada — acompanhe em Solicitações de ajustes."),
      ).toBeTruthy();
    });
    expect(stored).toHaveLength(1);
    expect(stored[0].reason).toBe("Esqueci de bater o ponto de saída ontem");
  });

  it("lists a previously submitted request", async () => {
    stored.push({
      id: "1",
      reason: "Esqueci de bater o ponto de saída ontem",
      status: "pendente",
      createdAt: new Date().toISOString(),
    });

    renderRouter("src/app", { initialUrl: "/solicitacoes" });

    await waitFor(() => {
      expect(screen.getByText("Esqueci de bater o ponto de saída ontem")).toBeTruthy();
    });
    expect(screen.queryByText("Nenhuma solicitação ainda")).toBeNull();
  });
});
