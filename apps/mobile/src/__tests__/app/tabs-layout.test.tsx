import { renderRouter, screen } from "expo-router/testing-library";

describe("(tabs) navigation", () => {
  it("renders a tab bar with all 5 sections", () => {
    renderRouter("src/app", { initialUrl: "/" });

    expect(screen.getByText("Ponto")).toBeTruthy();
    expect(screen.getByText("Banco de Horas")).toBeTruthy();
    expect(screen.getByText("Férias")).toBeTruthy();
    expect(screen.getByText("Documentos")).toBeTruthy();
    expect(screen.getByText("Mural")).toBeTruthy();

    expect(screen.getAllByLabelText(/, tab, \d+ of \d+$/)).toHaveLength(5);
  });

  it("navigates to the Banco de Horas route", () => {
    renderRouter("src/app", { initialUrl: "/banco-de-horas" });

    expect(screen).toHavePathname("/banco-de-horas");
  });
});
