import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";

const TASKS = [
  { id: "contrato", icon: "document-text-outline", title: "Assinar o contrato", description: "Revise e assine.", order: 1 },
  { id: "documentos", icon: "cloud-upload-outline", title: "Enviar documentos", description: "RG, CPF etc.", order: 2 },
];

describe("onboarding screen", () => {
  beforeEach(async () => {
    globalThis.fetch = jest.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/toggle")) {
        return Promise.resolve({ ok: true, json: async () => ({ completed: true }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ tasks: TASKS, completedTaskIds: [] }),
      });
    });
    await saveSessionToken("test-token");
  });

  it("renders all steps and starts at 0 of N completed", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });

    await waitFor(() => {
      expect(screen.getByText("Assinar o contrato")).toBeTruthy();
    });
    expect(screen.getByText("0 de 2 concluídos")).toBeTruthy();
  });

  it("toggles a step as completed and updates the progress count", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });

    await waitFor(() => {
      expect(screen.getByText("Assinar o contrato")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Assinar o contrato"));

    await waitFor(() => {
      expect(screen.getByText("1 de 2 concluídos")).toBeTruthy();
    });
  });
});
