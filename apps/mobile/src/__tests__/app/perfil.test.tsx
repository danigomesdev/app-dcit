import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { getSessionToken, saveSessionToken } from "@/lib/session";

function fakeJwt(claims: Record<string, unknown>) {
  const BASE64URL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  function encode(value: string) {
    const bytes = encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
    let bits = "";
    for (let i = 0; i < bytes.length; i++) bits += bytes.charCodeAt(i).toString(2).padStart(8, "0");
    let out = "";
    for (let i = 0; i + 6 <= bits.length; i += 6) out += BASE64URL_CHARS[parseInt(bits.slice(i, i + 6), 2)];
    const remainder = bits.length % 6;
    if (remainder) out += BASE64URL_CHARS[parseInt(bits.slice(-remainder).padEnd(6, "0"), 2)];
    return out;
  }
  return `${encode("{}")}.${encode(JSON.stringify(claims))}.signature`;
}

describe("perfil screen", () => {
  it("shows the logged-in user's name and role", async () => {
    await saveSessionToken(fakeJwt({ sub: "rh-1", role: "rh", name: "Carla RH" }));

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByLabelText("Abrir perfil"));

    await waitFor(() => {
      expect(screen).toHavePathname("/perfil");
    });
    await waitFor(() => {
      expect(screen.getAllByText("Carla RH").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("RH")).toBeTruthy();
  });

  it("clears the session and returns to login on logout", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByLabelText("Abrir perfil"));
    await waitFor(() => {
      expect(screen).toHavePathname("/perfil");
    });
    await waitFor(() => {
      expect(screen.getByText("Sair da conta")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Sair da conta"));

    await waitFor(() => {
      expect(screen).toHavePathname("/login");
    });
    expect(await getSessionToken()).toBeNull();
  });

  it("navigates to onboarding, benefícios and operacional from the menu", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByLabelText("Abrir perfil"));
    await waitFor(() => {
      expect(screen).toHavePathname("/perfil");
    });

    fireEvent.press(screen.getByText("Boas-vindas / Onboarding"));
    await waitFor(() => {
      expect(screen).toHavePathname("/onboarding");
    });
    fireEvent.press(screen.getByLabelText("Voltar"));

    fireEvent.press(screen.getByText("Benefícios e clube de vantagens"));
    await waitFor(() => {
      expect(screen).toHavePathname("/beneficios");
    });
    fireEvent.press(screen.getByLabelText("Voltar"));

    fireEvent.press(screen.getByText("Operacional / TI"));
    await waitFor(() => {
      expect(screen).toHavePathname("/operacional");
    });
  });

  it("hides the team-atestados menu row for a colaborador", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByLabelText("Abrir perfil"));
    await waitFor(() => {
      expect(screen).toHavePathname("/perfil");
    });

    expect(screen.queryByText("Atestados da equipe")).toBeNull();
  });

  it("shows and navigates to the team-atestados menu row for a gestor", async () => {
    await saveSessionToken(fakeJwt({ sub: "gestor-1", role: "gestor", name: "Bruno Gestor" }));

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByLabelText("Abrir perfil"));
    await waitFor(() => {
      expect(screen).toHavePathname("/perfil");
    });

    fireEvent.press(screen.getByText("Atestados da equipe"));
    await waitFor(() => {
      expect(screen).toHavePathname("/atestados-equipe");
    });
  });
});
