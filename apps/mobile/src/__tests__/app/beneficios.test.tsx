import { renderRouter, screen } from "expo-router/testing-library";

describe("beneficios screen", () => {
  it("shows benefit balances and partner discounts", () => {
    renderRouter("src/app", { initialUrl: "/beneficios" });

    expect(screen.getByText("Vale-refeição")).toBeTruthy();
    expect(screen.getByText("Smart Fit")).toBeTruthy();
    expect(screen.getByText("20% de desconto")).toBeTruthy();
  });
});
