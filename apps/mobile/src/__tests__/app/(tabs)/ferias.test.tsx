import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

describe("ferias screen", () => {
  it("renders the balance card and seeded requests with colored statuses", () => {
    renderRouter("src/app", { initialUrl: "/ferias" });

    expect(screen.getByText("22 dias disponíveis")).toBeTruthy();
    expect(screen.getByText(/Vencem em/)).toBeTruthy();
    expect(screen.getByText("Aprovado")).toBeTruthy();
    expect(screen.getByText("Recusado")).toBeTruthy();
  });

  it("shows vacation history entries", () => {
    renderRouter("src/app", { initialUrl: "/ferias" });

    expect(screen.getByText("Histórico de férias")).toBeTruthy();
    expect(screen.getByText("2025")).toBeTruthy();
    expect(screen.getByText("2024")).toBeTruthy();
  });

  it("opens the date picker when Solicitar Férias is pressed", () => {
    renderRouter("src/app", { initialUrl: "/ferias" });

    fireEvent.press(screen.getByText("Solicitar Férias"));

    expect(screen.getByText("Escolha o período")).toBeTruthy();
  });

  it("submits a new vacation request after picking a date range", () => {
    renderRouter("src/app", { initialUrl: "/ferias" });

    fireEvent.press(screen.getByText("Solicitar Férias"));

    const start = new Date();
    start.setDate(start.getDate() + 10);
    const end = new Date();
    end.setDate(end.getDate() + 14);
    const key = (date: Date) => date.toISOString().slice(0, 10);

    fireEvent.press(screen.getByTestId(`vacation-calendar.day_${key(start)}`));
    fireEvent.press(screen.getByTestId(`vacation-calendar.day_${key(end)}`));

    fireEvent.press(screen.getByText(/^Confirmar/));

    expect(screen.queryByText("Escolha o período")).toBeNull();
    expect(screen.getAllByText("Pendente").length).toBeGreaterThan(0);
  });
});
