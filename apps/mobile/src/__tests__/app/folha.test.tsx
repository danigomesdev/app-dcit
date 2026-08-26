import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";

globalThis.fetch = jest.fn();

describe("folha screen", () => {
  beforeEach(async () => {
    (globalThis.fetch as jest.Mock).mockReset();
    await saveSessionToken("test-token");
  });

  it("shows an empty state with no days registered yet", () => {
    renderRouter("src/app", { initialUrl: "/folha" });

    expect(screen.getByText("Nenhum dia registrado ainda")).toBeTruthy();
  });

  it("summarizes today after a punch is registered", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true });

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByText("Bater Ponto"));
    await waitFor(() => {
      expect(screen.queryByText(/Registrado às: --:--/)).toBeNull();
    });

    fireEvent.press(screen.getByText("Folha de ponto"));

    expect(screen).toHavePathname("/folha");
    expect(screen.queryByText("Nenhum dia registrado ainda")).toBeNull();
    expect(screen.getByText(/ponto em aberto/)).toBeTruthy();
  });
});
