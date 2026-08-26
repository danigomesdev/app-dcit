import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";

const SEEDED_REQUESTS = [
  {
    id: "seed-1",
    startDate: "2026-10-05",
    endDate: "2026-10-14",
    days: 10,
    createdAt: "2026-08-01T12:00:00.000Z",
    status: "aprovado",
  },
  {
    id: "seed-2",
    startDate: "2026-12-20",
    endDate: "2026-12-24",
    days: 5,
    createdAt: "2026-08-10T12:00:00.000Z",
    status: "recusado",
  },
];

const SEEDED_HISTORY = [
  {
    id: "hist-1",
    year: 2025,
    daysTaken: 20,
    startDate: "2025-12-15T00:00:00.000Z",
    endDate: "2026-01-03T00:00:00.000Z",
  },
  {
    id: "hist-2",
    year: 2024,
    daysTaken: 30,
    startDate: "2024-07-08T00:00:00.000Z",
    endDate: "2024-08-06T00:00:00.000Z",
  },
];

function mockFeriasGet() {
  (globalThis.fetch as jest.Mock).mockImplementation((_url: string, options?: RequestInit) => {
    if (options?.method === "POST") {
      const body = JSON.parse(options.body as string) as {
        startDate: string;
        endDate: string;
        days: number;
      };
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: "new-1",
          ...body,
          status: "pendente",
          createdAt: new Date().toISOString(),
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ requests: SEEDED_REQUESTS, hireDate: null, history: SEEDED_HISTORY }),
    });
  });
}

describe("ferias screen", () => {
  beforeEach(async () => {
    globalThis.fetch = jest.fn();
    mockFeriasGet();
    await saveSessionToken("test-token");
  });

  it("renders the balance card and seeded requests with colored statuses", async () => {
    renderRouter("src/app", { initialUrl: "/ferias" });

    expect(screen.getByText("22 dias disponíveis")).toBeTruthy();
    expect(screen.getByText(/Vencem em/)).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText("Aprovado")).toBeTruthy();
    });
    expect(screen.getByText("Recusado")).toBeTruthy();
  });

  it("shows vacation history entries", async () => {
    renderRouter("src/app", { initialUrl: "/ferias" });

    expect(screen.getByText("Histórico de férias")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText("2025")).toBeTruthy();
    });
    expect(screen.getByText("2024")).toBeTruthy();
  });

  it("opens the date picker when Solicitar Férias is pressed", () => {
    renderRouter("src/app", { initialUrl: "/ferias" });

    fireEvent.press(screen.getByText("Solicitar Férias"));

    expect(screen.getByText("Escolha o período")).toBeTruthy();
  });

  it("submits a new vacation request after picking a date range", async () => {
    renderRouter("src/app", { initialUrl: "/ferias" });
    await waitFor(() => {
      expect(screen.getByText("Aprovado")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Solicitar Férias"));

    const start = new Date();
    start.setDate(start.getDate() + 10);
    const end = new Date();
    end.setDate(end.getDate() + 14);
    const key = (date: Date) => date.toISOString().slice(0, 10);

    fireEvent.press(screen.getByTestId(`vacation-calendar.day_${key(start)}`));
    fireEvent.press(screen.getByTestId(`vacation-calendar.day_${key(end)}`));

    fireEvent.press(screen.getByText(/^Confirmar/));

    await waitFor(() => {
      expect(screen.queryByText("Escolha o período")).toBeNull();
    });
    expect(screen.getAllByText("Pendente").length).toBeGreaterThan(0);
  });
});
