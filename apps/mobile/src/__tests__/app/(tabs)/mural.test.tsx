import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

describe("mural screen", () => {
  it("highlights today's birthday and lists the rest of the month", () => {
    renderRouter("src/app", { initialUrl: "/mural" });

    expect(screen.getByText("Aniversariante(s) de hoje")).toBeTruthy();
    expect(screen.getByText("Ana Colaboradora")).toBeTruthy();
    expect(screen.getByText(/Bruno Gestor/)).toBeTruthy();
  });

  it("renders the feed newest-first with a welcome post", () => {
    renderRouter("src/app", { initialUrl: "/mural" });

    expect(screen.getByText("Bem-vindo(a), Marina!")).toBeTruthy();
    expect(screen.getByText("Resultado do trimestre")).toBeTruthy();
  });

  it("toggles a reaction and updates the count", () => {
    renderRouter("src/app", { initialUrl: "/mural" });

    expect(screen.getByText("12")).toBeTruthy();
    fireEvent.press(screen.getByText("12"));
    expect(screen.getByText("13")).toBeTruthy();
  });
});
