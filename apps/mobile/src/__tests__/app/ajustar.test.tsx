import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";

globalThis.fetch = jest.fn();

describe("ajustar screen", () => {
  beforeEach(async () => {
    (globalThis.fetch as jest.Mock).mockReset();
    await saveSessionToken("test-token");
  });

  it("submits a request and shows a confirmation", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "1", reason: "test", status: "pendente", createdAt: "now" }),
    });

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
  });

  it("does nothing when the reason is empty", () => {
    renderRouter("src/app", { initialUrl: "/ajustar" });

    fireEvent.press(screen.getByText("Enviar solicitação"));

    expect(
      screen.queryByText("Solicitação enviada — acompanhe em Solicitações de ajustes."),
    ).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("shows an error message when the request fails", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });

    renderRouter("src/app", { initialUrl: "/ajustar" });

    fireEvent.changeText(
      screen.getByPlaceholderText("Ex: esqueci de bater o ponto de saída às 18h"),
      "Esqueci de bater o ponto de saída ontem",
    );
    fireEvent.press(screen.getByText("Enviar solicitação"));

    await waitFor(() => {
      expect(
        screen.getByText("Não foi possível enviar a solicitação. Tente novamente."),
      ).toBeTruthy();
    });
  });
});
