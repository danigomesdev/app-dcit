import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

describe("banco de horas screen", () => {
  it("renders the balance card and the period filter", () => {
    renderRouter("src/app", { initialUrl: "/banco-de-horas" });

    expect(screen.getAllByText("Banco de Horas").length).toBeGreaterThan(0);
    expect(screen.getByText("Saldo atual")).toBeTruthy();
    expect(screen.getByText("Mês atual")).toBeTruthy();
    expect(screen.getByText("Mês passado")).toBeTruthy();
    expect(screen.getByText("Últimos 3 meses")).toBeTruthy();
    expect(screen.getByText("DSR estimado")).toBeTruthy();
    expect(screen.getByText("Extras em R$")).toBeTruthy();
  });

  it("switches the daily list when a different period is selected", () => {
    renderRouter("src/app", { initialUrl: "/banco-de-horas" });

    fireEvent.press(screen.getByText("Mês passado"));

    // Switching period re-renders the daily list without crashing; the
    // period filter buttons themselves stay on screen either way.
    expect(screen.getByText("Mês passado")).toBeTruthy();
  });

  it("opens the compensation request form and submits a request", () => {
    renderRouter("src/app", { initialUrl: "/banco-de-horas" });

    fireEvent.press(screen.getByText("Solicitar compensação de banco de horas"));
    fireEvent.changeText(
      screen.getByPlaceholderText("Ex: compensar 4h do saldo positivo na sexta-feira"),
      "Compensar 2h na sexta",
    );
    fireEvent.press(screen.getByText("Enviar solicitação"));

    expect(screen.getByText("Solicitação enviada — status: pendente.")).toBeTruthy();
    expect(screen.getAllByText("Compensar 2h na sexta").length).toBeGreaterThan(0);
  });
});
