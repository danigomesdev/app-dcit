import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";
import { currentVacationCycle, daysUntil } from "@/lib/ferias";

globalThis.fetch = jest.fn();

describe("notificacoes screen", () => {
  beforeEach(async () => {
    (globalThis.fetch as jest.Mock).mockReset();
    await saveSessionToken("test-token");
  });

  it("shows the vacation deadline notice only when the cycle is actually close to expiring", () => {
    renderRouter("src/app", { initialUrl: "/notificacoes" });

    const shouldWarn = daysUntil(currentVacationCycle().vencimento) <= 90;
    const notice = screen.queryByText("Suas férias estão vencendo");
    expect(notice !== null).toBe(shouldWarn);
  });

  it("adds a pending-sync notice after an offline punch", async () => {
    (globalThis.fetch as jest.Mock).mockRejectedValue(new TypeError("Network request failed"));

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByText("Bater Ponto"));
    await waitFor(() => {
      expect(screen.getByText(/1 ponto\(s\) registrado\(s\) offline/)).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Notificações"));

    await waitFor(() => {
      expect(screen).toHavePathname("/notificacoes");
    });
    expect(screen.getByText("Pontos aguardando sincronização")).toBeTruthy();
  });

  it("shows a notice when there's a jornada alert", async () => {
    (globalThis.fetch as jest.Mock).mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/alertas/minhas")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: "alert-1",
              type: "interjornada",
              date: "2026-09-02T00:00:00.000Z",
              minutesShort: 240,
            },
          ],
        });
      }
      return Promise.resolve({ ok: false });
    });

    renderRouter("src/app", { initialUrl: "/notificacoes" });

    await waitFor(() => {
      expect(screen.getByText("Intervalo entre turnos não cumprido")).toBeTruthy();
    });
  });

  it("shows server notifications above the computed notices, marks read and navigates on tap", async () => {
    (globalThis.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("/notifications/mine")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: "n1",
              type: "pagamento",
              category: "salario",
              message: "Seu salário foi depositado.",
              link: "/historico",
              createdAt: "2026-09-02T21:00:00.000Z",
              readAt: null,
            },
          ],
        });
      }
      if (typeof url === "string" && url.includes("/notifications/n1/read") && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      return Promise.resolve({ ok: false });
    });

    renderRouter("src/app", { initialUrl: "/notificacoes" });

    await waitFor(() => {
      expect(screen.getByText("Seu salário foi depositado.")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Seu salário foi depositado."));

    await waitFor(() => {
      expect(screen).toHavePathname("/historico");
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/notifications/n1/read"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows the empty state only when there are neither server notifications nor computed notices", () => {
    (globalThis.fetch as jest.Mock).mockImplementation(() => Promise.resolve({ ok: false }));

    renderRouter("src/app", { initialUrl: "/notificacoes" });

    expect(screen.getByText("Tudo em dia")).toBeTruthy();
  });
});
