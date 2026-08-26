import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

describe("solicitacoes screen", () => {
  it("shows an empty state with no requests yet", () => {
    renderRouter("src/app", { initialUrl: "/solicitacoes" });

    expect(screen.getByText("Nenhuma solicitação ainda")).toBeTruthy();
  });

  it("lists a request submitted from Ajustar meu ponto", () => {
    renderRouter("src/app", { initialUrl: "/" });

    fireEvent.press(screen.getByText("Ajustar meu ponto"));
    expect(screen).toHavePathname("/ajustar");

    fireEvent.changeText(
      screen.getByPlaceholderText("Ex: esqueci de bater o ponto de saída às 18h"),
      "Esqueci de bater o ponto de saída ontem",
    );
    fireEvent.press(screen.getByText("Enviar solicitação"));

    fireEvent.press(screen.getByLabelText("Voltar"));
    expect(screen).toHavePathname("/");

    fireEvent.press(screen.getByText("Solicitações de ajustes"));

    expect(screen).toHavePathname("/solicitacoes");
    expect(screen.getByText("Esqueci de bater o ponto de saída ontem")).toBeTruthy();
    expect(screen.queryByText("Nenhuma solicitação ainda")).toBeNull();
  });
});
