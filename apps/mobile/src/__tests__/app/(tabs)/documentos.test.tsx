import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { saveSessionToken } from "@/lib/session";

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("expo-file-system/legacy", () => ({
  readAsStringAsync: jest.fn().mockResolvedValue("ZmFrZS1pbWFnZS1kYXRh"),
  EncodingType: { Base64: "base64", UTF8: "utf8" },
}));

type StoredAtestado = {
  id: string;
  userId: string;
  userName: string;
  status: string;
  cid: string;
  crm: string;
  medico: string;
  dias: number;
  photoUri: string | null;
  createdAt: string;
};

type StoredCertification = {
  id: string;
  name: string;
  institution: string;
  validUntil: string;
  createdAt: string;
};

globalThis.fetch = jest.fn();

describe("documentos screen", () => {
  let storedAtestados: StoredAtestado[];
  let storedCertifications: StoredCertification[];

  beforeEach(async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
    });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true });

    storedAtestados = [
      {
        id: "seed-1",
        userId: "seed-user",
        userName: "Ana Colaboradora",
        status: "aprovado",
        cid: "J06.9",
        crm: "CRM-MG 45213",
        medico: "Dr. Carlos Mendes",
        dias: 2,
        photoUri: null,
        createdAt: "2026-07-10T09:00:00.000Z",
      },
      {
        id: "seed-2",
        userId: "seed-user",
        userName: "Ana Colaboradora",
        status: "recusado",
        cid: "M54.5",
        crm: "CRM-MG 78120",
        medico: "Dra. Beatriz Lima",
        dias: 1,
        photoUri: null,
        createdAt: "2026-05-22T09:00:00.000Z",
      },
    ];
    storedCertifications = [];

    (globalThis.fetch as jest.Mock).mockReset();
    (globalThis.fetch as jest.Mock).mockImplementation((url: string, options?: RequestInit) => {
      if (url.endsWith("/atestados") && options?.method === "POST") {
        const body = JSON.parse(options.body as string) as Record<string, unknown>;
        const record: StoredAtestado = {
          id: `new-${storedAtestados.length + 1}`,
          userId: "test-user",
          userName: "Test User",
          status: "enviado",
          photoUri: null,
          createdAt: new Date().toISOString(),
          ...body,
        } as StoredAtestado;
        storedAtestados = [record, ...storedAtestados];
        return Promise.resolve({ ok: true, json: async () => record });
      }
      if (url.endsWith("/atestados/mine")) {
        return Promise.resolve({ ok: true, json: async () => storedAtestados });
      }
      if (url.endsWith("/documentos/admissionais")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: "adm-1",
              title: "Contrato de trabalho assinado",
              photoUri: null,
              status: "aprovado",
              submittedAt: "2024-03-15T00:00:00.000Z",
            },
          ],
        });
      }
      if (url.endsWith("/documentos/holerites")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: "p-1", label: "Julho 2026", gross: 6200, inss: 682, irrf: 410, benefits: 380 },
          ],
        });
      }
      if (url.endsWith("/documentos/certificacoes") && options?.method === "POST") {
        const body = JSON.parse(options.body as string) as Record<string, unknown>;
        const record: StoredCertification = {
          id: `cert-${storedCertifications.length + 1}`,
          createdAt: new Date().toISOString(),
          ...body,
        } as StoredCertification;
        storedCertifications = [record, ...storedCertifications];
        return Promise.resolve({ ok: true, json: async () => record });
      }
      if (url.endsWith("/documentos/certificacoes")) {
        return Promise.resolve({ ok: true, json: async () => storedCertifications });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    await saveSessionToken("test-token");
  });

  it("defaults to the Atestados category with the seeded status list", async () => {
    renderRouter("src/app", { initialUrl: "/documentos" });

    expect(screen.getByText("Enviar Atestado")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText("Aprovado")).toBeTruthy();
    });
    expect(screen.getByText("Recusado")).toBeTruthy();
  });

  it("shows the seeded admission documents when that category is selected", async () => {
    renderRouter("src/app", { initialUrl: "/documentos" });

    fireEvent.press(screen.getByText("Admissionais"));

    await waitFor(() => {
      expect(screen.getByText("Contrato de trabalho assinado")).toBeTruthy();
    });
  });

  it("submits a new atestado through the manual form", async () => {
    renderRouter("src/app", { initialUrl: "/documentos" });

    fireEvent.press(screen.getByText("Enviar Atestado"));
    fireEvent.changeText(screen.getByPlaceholderText("CID"), "J06.9");
    fireEvent.changeText(screen.getByPlaceholderText("CRM do médico"), "CRM-MG 11111");
    fireEvent.changeText(screen.getByPlaceholderText("Nome do médico"), "Dr. Teste");
    fireEvent.changeText(screen.getByPlaceholderText("Quantidade de dias"), "3");
    fireEvent.press(screen.getByText("Enviar"));

    await waitFor(() => {
      expect(screen.getAllByText(/CRM-MG 11111/).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("Enviado").length).toBeGreaterThan(0);
  });

  it("opens the camera when Tirar foto is pressed and previews the captured photo", async () => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://fake-photo.jpg" }],
    });

    renderRouter("src/app", { initialUrl: "/documentos" });
    fireEvent.press(screen.getByText("Enviar Atestado"));
    fireEvent.press(screen.getByText("Tirar foto"));

    await waitFor(() => {
      expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
    });
  });

  it("prefills the atestado fields after a successful automatic OCR read", async () => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://fake-photo.jpg" }],
    });
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        cid: "J06.9",
        crm: "CRM-MG 45213",
        medico: "Dr. Carlos Mendes",
        dias: 2,
      }),
    });

    renderRouter("src/app", { initialUrl: "/documentos" });
    fireEvent.press(screen.getByText("Enviar Atestado"));
    fireEvent.press(screen.getByText("Tirar foto"));

    await waitFor(() => {
      expect(screen.getByText(/Dados preenchidos automaticamente/)).toBeTruthy();
    });
    expect(screen.getByDisplayValue("J06.9")).toBeTruthy();
    expect(screen.getByDisplayValue("CRM-MG 45213")).toBeTruthy();
    expect(screen.getByDisplayValue("Dr. Carlos Mendes")).toBeTruthy();
    expect(screen.getByDisplayValue("2")).toBeTruthy();
  });

  it("falls back to manual entry when the OCR request fails", async () => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://fake-photo.jpg" }],
    });
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });

    renderRouter("src/app", { initialUrl: "/documentos" });
    fireEvent.press(screen.getByText("Enviar Atestado"));
    fireEvent.press(screen.getByText("Tirar foto"));

    await waitFor(() => {
      expect(screen.getByText(/Não foi possível ler automaticamente/)).toBeTruthy();
    });
    expect(screen.getByPlaceholderText("CID").props.value).toBe("");
  });

  it("expands a payslip to show the discount breakdown", async () => {
    renderRouter("src/app", { initialUrl: "/documentos" });

    fireEvent.press(screen.getByText("Holerites"));
    await waitFor(() => {
      expect(screen.getByText("Julho 2026")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Julho 2026"));

    expect(screen.getByText("Salário bruto")).toBeTruthy();
    expect(screen.getByText("Líquido a receber")).toBeTruthy();
  });

  it("downloads a payslip as a PDF when Baixar PDF is pressed", async () => {
    (Sharing.shareAsync as jest.Mock).mockClear();
    renderRouter("src/app", { initialUrl: "/documentos" });

    fireEvent.press(screen.getByText("Holerites"));
    await waitFor(() => {
      expect(screen.getByText("Julho 2026")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Julho 2026"));

    fireEvent.press(screen.getByText("Baixar PDF"));

    await waitFor(() => {
      expect(Sharing.shareAsync).toHaveBeenCalled();
    });
  });

  it("adds a new certification", async () => {
    renderRouter("src/app", { initialUrl: "/documentos" });

    fireEvent.press(screen.getByText("Certificações"));
    await waitFor(() => {
      expect(screen.getByText("Nenhuma certificação cadastrada")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Adicionar certificação"));
    fireEvent.changeText(screen.getByPlaceholderText("Nome da certificação"), "AWS Certified");
    fireEvent.changeText(screen.getByPlaceholderText("Instituição"), "Amazon");
    fireEvent.changeText(screen.getByPlaceholderText("Validade (DD/MM/AAAA)"), "10/10/2028");
    fireEvent.press(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(screen.getByText("AWS Certified")).toBeTruthy();
    });
  });
});
