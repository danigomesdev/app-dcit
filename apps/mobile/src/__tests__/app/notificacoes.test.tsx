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
});
