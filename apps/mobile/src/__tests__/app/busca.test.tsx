import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

describe("busca screen", () => {
  it("shows a prompt before typing anything", () => {
    renderRouter("src/app", { initialUrl: "/busca" });

    expect(screen.getByText("Busque no seu conteúdo")).toBeTruthy();
  });

  it("filters results as the user types and finds a mural post", () => {
    renderRouter("src/app", { initialUrl: "/busca" });

    fireEvent.changeText(
      screen.getByPlaceholderText("Buscar documentos, atestados, avisos..."),
      "clube de vantagens",
    );

    expect(screen.getByText("Nova parceria no clube de vantagens")).toBeTruthy();
  });

  it("shows an empty state when nothing matches", () => {
    renderRouter("src/app", { initialUrl: "/busca" });

    fireEvent.changeText(
      screen.getByPlaceholderText("Buscar documentos, atestados, avisos..."),
      "xyzxyzxyz",
    );

    expect(screen.getByText("Nada encontrado")).toBeTruthy();
  });
});
