import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

describe("ajustar screen", () => {
  it("submits a request and shows a confirmation", () => {
    renderRouter("src/app", { initialUrl: "/ajustar" });

    fireEvent.changeText(
      screen.getByPlaceholderText("Ex: esqueci de bater o ponto de saída às 18h"),
      "Esqueci de bater o ponto de saída ontem",
    );
    fireEvent.press(screen.getByText("Enviar solicitação"));

    expect(
      screen.getByText("Solicitação enviada — acompanhe em Solicitações de ajustes."),
    ).toBeTruthy();
  });

  it("does nothing when the reason is empty", () => {
    renderRouter("src/app", { initialUrl: "/ajustar" });

    fireEvent.press(screen.getByText("Enviar solicitação"));

    expect(
      screen.queryByText("Solicitação enviada — acompanhe em Solicitações de ajustes."),
    ).toBeNull();
  });
});
