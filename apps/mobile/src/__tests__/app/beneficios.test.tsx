import { renderRouter, screen, waitFor } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";

const BALANCES = [
  { id: "vr", icon: "restaurant-outline", label: "Vale-refeição", balance: 412.5, monthlyCredit: 600 },
  { id: "vt", icon: "bus-outline", label: "Vale-transporte", balance: 88.0, monthlyCredit: 220 },
];

const PARTNERS = [{ id: "1", name: "Smart Fit", category: "Academia", discount: "20% de desconto" }];

describe("beneficios screen", () => {
  beforeEach(async () => {
    globalThis.fetch = jest.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.endsWith("/beneficios/parceiros")) {
        return Promise.resolve({ ok: true, json: async () => PARTNERS });
      }
      return Promise.resolve({ ok: true, json: async () => BALANCES });
    });
    await saveSessionToken("test-token");
  });

  it("shows benefit balances and partner discounts", async () => {
    renderRouter("src/app", { initialUrl: "/beneficios" });

    await waitFor(() => {
      expect(screen.getByText("Vale-refeição")).toBeTruthy();
    });
    expect(screen.getByText("Smart Fit")).toBeTruthy();
    expect(screen.getByText("20% de desconto")).toBeTruthy();
  });
});
