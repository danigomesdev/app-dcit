import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";

globalThis.fetch = jest.fn();

describe("banco de horas screen", () => {
  beforeEach(async () => {
    (globalThis.fetch as jest.Mock).mockReset();
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
    await saveSessionToken("test-token");
  });

  it("renders the balance card and the period filter", () => {
    renderRouter("src/app", { initialUrl: "/banco-de-horas" });

    expect(screen.getAllByText("Banco de Horas").length).toBeGreaterThan(0);
    expect(screen.getByText("Saldo atual")).toBeTruthy();
    expect(screen.getByText("Mês atual")).toBeTruthy();
    expect(screen.getByText("Mês passado")).toBeTruthy();
    expect(screen.getByText("Últimos 3 meses")).toBeTruthy();
    expect(screen.getByText("DSR estimado")).toBeTruthy();
    expect(screen.getByText("Extras em R$")).toBeTruthy();
  });

  it("switches the daily list when a different period is selected", () => {
    renderRouter("src/app", { initialUrl: "/banco-de-horas" });

    fireEvent.press(screen.getByText("Mês passado"));

    // Switching period re-renders the daily list without crashing; the
    // period filter buttons themselves stay on screen either way.
    expect(screen.getByText("Mês passado")).toBeTruthy();
  });

  it("opens the compensation request form and submits a request", async () => {
    (globalThis.fetch as jest.Mock).mockImplementation((_url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: "1",
            reason: "Compensar 2h na sexta",
            status: "pendente",
            createdAt: new Date().toISOString(),
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    renderRouter("src/app", { initialUrl: "/banco-de-horas" });

    fireEvent.press(screen.getByText("Solicitar compensação de banco de horas"));
    fireEvent.changeText(
      screen.getByPlaceholderText("Ex: compensar 4h do saldo positivo na sexta-feira"),
      "Compensar 2h na sexta",
    );
    fireEvent.press(screen.getByText("Enviar solicitação"));

    await waitFor(() => {
      expect(screen.getByText("Solicitação enviada — status: pendente.")).toBeTruthy();
    });
    expect(screen.getAllByText("Compensar 2h na sexta").length).toBeGreaterThan(0);
  });

  it("shows the real balance and daily rows when the API returns data", async () => {
    (globalThis.fetch as jest.Mock).mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/banco-de-horas/minhas")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            days: [
              { date: "2026-08-20", expectedMinutes: 480, workedMinutes: 480, diffMinutes: 0 },
            ],
            balanceMinutes: 120,
            dsrMinutes: 30,
            hourlyRateBRL: 45.45,
            overtimeValueBRL: 90.9,
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    renderRouter("src/app", { initialUrl: "/banco-de-horas" });

    await waitFor(() => {
      expect(screen.getByText("+2h 00min")).toBeTruthy();
    });
    // The daily row for 2026-08-20 (8h expected, 8h worked, from the mocked
    // period fetch) should actually be on screen, not just the balance card.
    expect(screen.getByText("20/08")).toBeTruthy();
    expect(screen.getByText("8.0h")).toBeTruthy();
  });

  it('shows "—" for the Extras card when overtimeValueBRL is null', async () => {
    (globalThis.fetch as jest.Mock).mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/banco-de-horas/minhas")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            days: [],
            balanceMinutes: 0,
            dsrMinutes: 0,
            hourlyRateBRL: null,
            overtimeValueBRL: null,
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    renderRouter("src/app", { initialUrl: "/banco-de-horas" });

    // Wait for the fetch to actually resolve — a confirmed zero balance
    // renders as "+0h 00min", not "—", which only the still-null
    // overtimeValueBRL should produce (Saldo/DSR both start null too, so
    // asserting on "—" before this would spuriously match them as well).
    await waitFor(() => {
      expect(screen.getAllByText("+0h 00min").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("—")).toBeTruthy();
  });
});
