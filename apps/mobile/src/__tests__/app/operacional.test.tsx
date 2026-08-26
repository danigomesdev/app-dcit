import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

describe("operacional screen", () => {
  it("shows the plantão schedule for the week", () => {
    renderRouter("src/app", { initialUrl: "/operacional" });

    expect(screen.getByText("Segunda")).toBeTruthy();
    expect(screen.getAllByText("Bruno Gestor").length).toBeGreaterThan(0);
  });

  it("toggles sobreaviso on and off", () => {
    renderRouter("src/app", { initialUrl: "/operacional" });

    expect(screen.getByText("Sobreaviso inativo")).toBeTruthy();
    fireEvent.press(screen.getByText("Ativar sobreaviso"));
    expect(screen.getByText("Sobreaviso ativo")).toBeTruthy();
    fireEvent.press(screen.getByText("Encerrar sobreaviso"));
    expect(screen.getByText("Sobreaviso inativo")).toBeTruthy();
  });

  it("tracks a deslocamento session from start to finish", () => {
    renderRouter("src/app", { initialUrl: "/operacional" });

    fireEvent.press(screen.getByText("Iniciar deslocamento"));
    expect(screen.getByText("Em deslocamento")).toBeTruthy();

    fireEvent.press(screen.getByText("Encerrar deslocamento"));
    expect(screen.getByText("Sem deslocamento em andamento")).toBeTruthy();
    expect(screen.getByText("Deslocamentos de hoje")).toBeTruthy();
  });
});
