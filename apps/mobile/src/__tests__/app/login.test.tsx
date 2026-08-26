import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import * as WebBrowser from "expo-web-browser";
import { getSessionToken } from "@/lib/session";

jest.mock("expo-web-browser", () => ({
  openAuthSessionAsync: jest.fn(),
}));

describe("login screen", () => {
  beforeEach(() => {
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockReset();
  });

  it("renders the SSO entry point", () => {
    renderRouter("src/app", { initialUrl: "/login" });

    expect(screen.getByText("Entre com sua conta corporativa para continuar.")).toBeTruthy();
    expect(screen.getByText("Entrar com SSO")).toBeTruthy();
  });

  it("stores the token and navigates to the Ponto tab on a successful login", async () => {
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: "success",
      url: "mobile://auth-callback?token=abc123",
    });

    renderRouter("src/app", { initialUrl: "/login" });
    fireEvent.press(screen.getByText("Entrar com SSO"));

    await waitFor(async () => {
      expect(screen).toHavePathname("/");
    });
    expect(await getSessionToken()).toBe("abc123");
  });

  it("stays on the login screen when the browser session is cancelled", async () => {
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({ type: "cancel" });

    renderRouter("src/app", { initialUrl: "/login" });
    fireEvent.press(screen.getByText("Entrar com SSO"));

    await waitFor(() => {
      expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalled();
    });
    expect(screen).toHavePathname("/login");
  });
});
