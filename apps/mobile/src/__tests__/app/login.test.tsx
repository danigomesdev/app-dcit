import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

describe("login screen", () => {
  it("renders the SSO entry point", () => {
    renderRouter("src/app", { initialUrl: "/login" });

    expect(screen.getByText("Entre com sua conta corporativa para continuar.")).toBeTruthy();
    expect(screen.getByText("Entrar com SSO")).toBeTruthy();
  });

  it("navigates to the Ponto tab after pressing Entrar com SSO", () => {
    renderRouter("src/app", { initialUrl: "/login" });

    fireEvent.press(screen.getByText("Entrar com SSO"));

    expect(screen).toHavePathname("/");
  });
});
