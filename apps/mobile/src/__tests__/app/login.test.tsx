import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import * as WebBrowser from "expo-web-browser";
import { clearSessionToken, getSessionToken, saveSessionToken } from "@/lib/session";

jest.mock("expo-web-browser", () => ({
  openAuthSessionAsync: jest.fn(),
}));

describe("login screen", () => {
  beforeEach(async () => {
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockReset();
    await clearSessionToken();
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  it("renders the SSO entry point when there is no saved session", async () => {
    renderRouter("src/app", { initialUrl: "/login" });

    await waitFor(() => {
      expect(screen.getByText("Entrar com SSO")).toBeTruthy();
    });
    expect(screen.getByText("Entre com sua conta corporativa para continuar.")).toBeTruthy();
  });

  it("skips straight to the Ponto tab when a session is already saved", async () => {
    await saveSessionToken("existing-token");

    renderRouter("src/app", { initialUrl: "/login" });

    await waitFor(() => {
      expect(screen).toHavePathname("/");
    });
  });

  it("stores the token and navigates to the Ponto tab on a successful login", async () => {
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: "success",
      url: "mobile://auth-callback?token=abc123",
    });

    renderRouter("src/app", { initialUrl: "/login" });
    await waitFor(() => {
      expect(screen.getByText("Entrar com SSO")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Entrar com SSO"));

    await waitFor(async () => {
      expect(screen).toHavePathname("/");
    });
    expect(await getSessionToken()).toBe("abc123");

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/push-tokens"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("stays on the login screen when the browser session is cancelled", async () => {
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({ type: "cancel" });

    renderRouter("src/app", { initialUrl: "/login" });
    await waitFor(() => {
      expect(screen.getByText("Entrar com SSO")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Entrar com SSO"));

    await waitFor(() => {
      expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalled();
    });
    expect(screen).toHavePathname("/login");
  });
});
