import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";

globalThis.fetch = jest.fn();

describe("historico screen", () => {
  beforeEach(async () => {
    (globalThis.fetch as jest.Mock).mockReset();
    await saveSessionToken("test-token");
  });

  it("shows an empty state with no punches yet", () => {
    renderRouter("src/app", { initialUrl: "/historico" });

    expect(screen.getByText("Nenhum ponto registrado ainda")).toBeTruthy();
  });

  it("lists a punch registered from the Ponto tab", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true });

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByText("Bater Ponto"));
    await waitFor(() => {
      expect(screen.queryByText(/Registrado às: --:--/)).toBeNull();
    });

    fireEvent.press(screen.getByText("Histórico de pontos"));

    expect(screen).toHavePathname("/historico");
    expect(screen.queryByText("Nenhum ponto registrado ainda")).toBeNull();
  });
});
