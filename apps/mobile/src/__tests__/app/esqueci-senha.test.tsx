import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

describe("esqueci senha screen", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  it("requests a reset code, shows the dev code, and redefines the password", async () => {
    (globalThis.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url.includes("/auth/forgot-password")) {
        return { ok: true, json: async () => ({ devCode: "123456" }) };
      }
      if (url.includes("/auth/reset-password")) {
        return { ok: true, json: async () => ({ ok: true }) };
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    renderRouter("src/app", { initialUrl: "/esqueci-senha" });

    fireEvent.changeText(screen.getByPlaceholderText("Email ou telefone"), "colaborador@dev.local");
    fireEvent.press(screen.getByText("Enviar código"));

    await waitFor(() => {
      expect(screen.getByText(/123456/)).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText("Código de 6 dígitos"), "123456");
    fireEvent.changeText(screen.getByPlaceholderText("Nova senha"), "novaSenha123");
    fireEvent.press(screen.getByText("Redefinir senha"));

    await waitFor(() => {
      expect(screen.getByText("Senha redefinida com sucesso.")).toBeTruthy();
    });
  });

  it("shows a generic message (no dev code) for an unknown identifier", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });

    renderRouter("src/app", { initialUrl: "/esqueci-senha" });

    fireEvent.changeText(screen.getByPlaceholderText("Email ou telefone"), "nao-existe@dev.local");
    fireEvent.press(screen.getByText("Enviar código"));

    await waitFor(() => {
      expect(screen.getByText("Se essa conta existir, um código foi gerado.")).toBeTruthy();
    });
  });

  it("shows an error for an invalid reset code", async () => {
    (globalThis.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url.includes("/auth/forgot-password")) {
        return { ok: true, json: async () => ({ devCode: "123456" }) };
      }
      return { ok: false, json: async () => ({}) };
    });

    renderRouter("src/app", { initialUrl: "/esqueci-senha" });

    fireEvent.changeText(screen.getByPlaceholderText("Email ou telefone"), "colaborador@dev.local");
    fireEvent.press(screen.getByText("Enviar código"));
    await waitFor(() => {
      expect(screen.getByText(/123456/)).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText("Código de 6 dígitos"), "000000");
    fireEvent.changeText(screen.getByPlaceholderText("Nova senha"), "novaSenha123");
    fireEvent.press(screen.getByText("Redefinir senha"));

    await waitFor(() => {
      expect(screen.getByText("Código inválido ou expirado.")).toBeTruthy();
    });
  });
});
