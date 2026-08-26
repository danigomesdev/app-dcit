import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { clearSessionToken, saveSessionToken } from "@/lib/session";

globalThis.fetch = jest.fn();

const BASE64URL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function base64UrlEncode(value: string): string {
  const bytes = encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
  let bits = "";
  for (let i = 0; i < bytes.length; i++) {
    bits += bytes.charCodeAt(i).toString(2).padStart(8, "0");
  }
  let output = "";
  for (let i = 0; i + 6 <= bits.length; i += 6) {
    output += BASE64URL_CHARS[parseInt(bits.slice(i, i + 6), 2)];
  }
  const remainder = bits.length % 6;
  if (remainder) {
    output += BASE64URL_CHARS[parseInt(bits.slice(-remainder).padEnd(6, "0"), 2)];
  }
  return output;
}

function fakeJwt(claims: Record<string, unknown>) {
  return `${base64UrlEncode("{}")}.${base64UrlEncode(JSON.stringify(claims))}.signature`;
}

describe("HomeScreen", () => {
  beforeEach(async () => {
    (globalThis.fetch as jest.Mock).mockReset();
    await saveSessionToken("test-token");
  });

  it("updates the last punch time after tapping Bater Ponto", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true });

    renderRouter("src/app", { initialUrl: "/" });
    expect(screen.getByText(/Registrado às: --:--/)).toBeTruthy();

    fireEvent.press(screen.getByText("Bater Ponto"));

    await waitFor(() => {
      expect(screen.queryByText(/Registrado às: --:--/)).toBeNull();
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/time-entries",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      })
    );
  });

  it("shows an error message when the request fails", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByText("Bater Ponto"));

    await waitFor(() => {
      expect(screen.getByText(/Falha ao registrar/i)).toBeTruthy();
    });
  });

  it("redirects to login and shows an error when there is no session token", async () => {
    await clearSessionToken();

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByText("Bater Ponto"));

    await waitFor(() => {
      expect(screen).toHavePathname("/login");
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("shows a confirmation modal with the logged-in user's name and role after a punch", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true });
    await saveSessionToken(
      fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana Colaboradora" }),
    );

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByText("Bater Ponto"));

    await waitFor(() => {
      expect(screen.getByText("Ponto registrado")).toBeTruthy();
    });
    expect(screen.getAllByText("Ana Colaboradora").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Colaborador").length).toBeGreaterThan(0);
    expect(screen.getByText("DCIT Tecnologia")).toBeTruthy();

    fireEvent.press(screen.getByText("Fechar"));
    await waitFor(() => {
      expect(screen.queryByText("Ponto registrado")).toBeNull();
    });
  });

  it("navigates to the history screen from the quick actions grid", () => {
    renderRouter("src/app", { initialUrl: "/" });

    fireEvent.press(screen.getByText("Histórico de pontos"));

    expect(screen).toHavePathname("/historico");
  });
});
