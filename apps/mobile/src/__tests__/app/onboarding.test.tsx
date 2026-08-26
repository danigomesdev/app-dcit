import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

describe("onboarding screen", () => {
  it("renders all steps and starts at 0 of N completed", () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });

    expect(screen.getByText("Assinar o contrato")).toBeTruthy();
    expect(screen.getByText("0 de 5 concluídos")).toBeTruthy();
  });

  it("toggles a step as completed and updates the progress count", () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });

    fireEvent.press(screen.getByText("Assinar o contrato"));

    expect(screen.getByText("1 de 5 concluídos")).toBeTruthy();
  });
});
