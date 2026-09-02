import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { clearSessionToken, getSessionToken, saveSessionToken } from "@/lib/session";

describe("login screen", () => {
  beforeEach(async () => {
    await clearSessionToken();
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  it("renders the email/password form when there is no saved session", async () => {
    renderRouter("src/app", { initialUrl: "/login" });

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Email")).toBeTruthy();
    });
    expect(screen.getByPlaceholderText("Senha")).toBeTruthy();
    expect(screen.getByText("Entrar")).toBeTruthy();
    expect(screen.getByText("Esqueci minha senha")).toBeTruthy();
    expect(screen.queryByText("Entrar com SSO")).toBeNull();
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
    (globalThis.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url.includes("/auth/password-login")) {
        return { ok: true, json: async () => ({ token: "abc123", role: "colaborador", name: "Ana" }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    renderRouter("src/app", { initialUrl: "/login" });
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Email")).toBeTruthy();
    });
    fireEvent.changeText(screen.getByPlaceholderText("Email"), "colaborador@dev.local");
    fireEvent.changeText(screen.getByPlaceholderText("Senha"), "dev12345");
    fireEvent.press(screen.getByText("Entrar"));

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

  it("refreshes notifications after a successful login", async () => {
    (globalThis.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url.includes("/auth/password-login")) {
        return { ok: true, json: async () => ({ token: "abc123", role: "colaborador", name: "Ana" }) };
      }
      return { ok: true, json: async () => [] };
    });

    renderRouter("src/app", { initialUrl: "/login" });
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Email")).toBeTruthy();
    });
    fireEvent.changeText(screen.getByPlaceholderText("Email"), "colaborador@dev.local");
    fireEvent.changeText(screen.getByPlaceholderText("Senha"), "dev12345");
    fireEvent.press(screen.getByText("Entrar"));

    await waitFor(async () => {
      expect(screen).toHavePathname("/");
    });

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/notifications/mine"),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer abc123" }) }),
      );
    });
  });

  it("shows an inline error and stays on the login screen for wrong credentials", async () => {
    (globalThis.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url.includes("/auth/password-login")) {
        return { ok: false, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({}) };
    });

    renderRouter("src/app", { initialUrl: "/login" });
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Email")).toBeTruthy();
    });
    fireEvent.changeText(screen.getByPlaceholderText("Email"), "colaborador@dev.local");
    fireEvent.changeText(screen.getByPlaceholderText("Senha"), "wrong-password");
    fireEvent.press(screen.getByText("Entrar"));

    await waitFor(() => {
      expect(screen.getByText("Email ou senha incorretos.")).toBeTruthy();
    });
    expect(screen).toHavePathname("/login");
  });
});
